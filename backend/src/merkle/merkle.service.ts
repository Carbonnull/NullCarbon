import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { RegistryService, Credit } from '../registry/registry.service';

// poseidon-lite exports poseidonN hashes over the BN254 field, one per input
// count. Merkle pair-hashing uses 2 inputs; credit leaves use 4.
// Fallback to a simple XOR hash if unavailable (testnet/dev only).
let poseidonHash2: (inputs: bigint[]) => bigint;
let poseidonHash4: (inputs: bigint[]) => bigint;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { poseidon2, poseidon4 } = require('poseidon-lite');
  poseidonHash2 = poseidon2;
  poseidonHash4 = poseidon4;
} catch {
  // Fallback: simple deterministic hash for development
  const fallback = (inputs: bigint[]) =>
    inputs.reduce((acc, v) => (acc ^ v) + 0x123456789abcdefn, 0n);
  poseidonHash2 = fallback;
  poseidonHash4 = fallback;
}

export interface MerkleTree {
  root: string;
  leaves: string[];
  nodes: string[][];
  depth: number;
}

export interface MerkleProof {
  creditHash: string;
  merklePath: string[];
  merkleIndices: number[];
  root: string;
}

const TREE_DEPTH = 20;
const ZERO_VALUE = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Root of a fully-empty subtree of each height. ZERO_HASHES[h] is the hash
// of 2^h zero leaves, so the sibling of a node covering 2^h leaves that lies
// outside the built tree is ZERO_HASHES[h]. Precomputed so proofs and the
// full-depth root can be derived without materializing the whole 2^TREE_DEPTH
// tree.
const ZERO_HASHES: string[] = [ZERO_VALUE];
for (let i = 1; i <= TREE_DEPTH; i++) {
  ZERO_HASHES.push(poseidon2Hash(ZERO_HASHES[i - 1], ZERO_HASHES[i - 1]));
}

function toHex(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0');
}

function fromHex(h: string): bigint {
  return BigInt(h.startsWith('0x') ? h : '0x' + h);
}

function poseidon2Hash(left: string, right: string): string {
  return toHex(poseidonHash2([fromHex(left), fromHex(right)]));
}

function computeLeafHash(credit: Credit): string {
  const creditIdField = BigInt(
    '0x' +
      Buffer.from(credit.creditId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 31))
        .toString('hex')
        .padStart(62, '0'),
  );
  return toHex(
    poseidonHash4([
      creditIdField,
      BigInt(credit.vintage),
      BigInt(credit.volume),
      BigInt(credit.methodologyCode),
    ]),
  );
}

function buildMerkleTree(leaves: string[]): MerkleTree {
  // Only build the smallest power-of-two tree that fits the leaves instead
  // of the full 2^TREE_DEPTH tree: a 2^20 build is ~2M hashes per registry.
  const leafCount = Math.max(1, leaves.length);
  const paddedSize = Math.min(
    Math.pow(2, Math.ceil(Math.log2(leafCount))),
    Math.pow(2, TREE_DEPTH),
  );
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < paddedSize) {
    paddedLeaves.push(ZERO_VALUE);
  }

  const nodes: string[][] = [paddedLeaves];
  let current = paddedLeaves;

  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(poseidon2Hash(current[i], current[i + 1]));
    }
    nodes.push(next);
    current = next;
  }

  // Fold the built root up through the empty remainder of the tree so the
  // returned root matches what a full-depth tree would produce. At each
  // step the current node is the leftmost node of its level, so its
  // sibling is a fully-empty subtree of that level (ZERO_HASHES[level]).
  const builtLevels = nodes.length - 1;
  let fullRoot = current[0];
  for (let level = builtLevels; level < TREE_DEPTH; level++) {
    fullRoot = poseidon2Hash(fullRoot, ZERO_HASHES[level]);
  }

  return {
    root: fullRoot,
    leaves: paddedLeaves,
    nodes,
    depth: TREE_DEPTH,
  };
}

function getMerkleProof(tree: MerkleTree, leafIndex: number): MerkleProof {
  const path: string[] = [];
  const indices: number[] = [];

  let idx = leafIndex;
  for (let level = 0; level < TREE_DEPTH; level++) {
    const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
    const levelNodes = tree.nodes[level];
    // Nodes beyond the built tree are entirely empty; a sibling at this
    // level covers 2^level zero leaves, whose root is ZERO_HASHES[level].
    const siblingNode =
      levelNodes && sibling < levelNodes.length
        ? levelNodes[sibling]
        : ZERO_HASHES[level];
    path.push(siblingNode);
    indices.push(idx % 2); // 0 = left, 1 = right
    idx = Math.floor(idx / 2);
  }

  return {
    creditHash: tree.leaves[leafIndex],
    merklePath: path,
    merkleIndices: indices,
    root: tree.root,
  };
}

@Injectable()
export class MerkleService {
  private trees = new Map<string, MerkleTree>();
  // creditHash → leaf index in tree
  private creditHashIndex = new Map<string, { registry: string; index: number }>();

  constructor(
    private readonly config: ConfigService,
    private readonly registryService: RegistryService,
    @Optional() @Inject('PG_POOL') private readonly db?: Pool,
  ) {}

  async rebuildTrees(): Promise<Record<string, string>> {
    const credits = await this.registryService.syncRegistry();
    const byRegistry = new Map<string, Credit[]>();

    for (const credit of credits) {
      const list = byRegistry.get(credit.registry) ?? [];
      list.push(credit);
      byRegistry.set(credit.registry, list);
    }

    const roots: Record<string, string> = {};

    for (const [registry, regCredits] of byRegistry.entries()) {
      // Compute leaf hashes
      const leaves = regCredits.map((c) => {
        const hash = computeLeafHash(c);
        // Store the computed hash back on the credit for lookup
        (c as any)._computedLeafHash = hash;
        return hash;
      });

      const tree = buildMerkleTree(leaves);
      this.trees.set(registry, tree);

      // Update creditHash index
      regCredits.forEach((c, i) => {
        const hash = (c as any)._computedLeafHash as string;
        this.creditHashIndex.set(hash, { registry, index: i });
        this.creditHashIndex.set(c.creditHash, { registry, index: i });
      });

      roots[registry] = tree.root;

      // Persist to DB if available
      if (this.db) {
        await this.db.query(
          `INSERT INTO merkle_snapshots (registry, merkle_root, depth, credit_count)
           VALUES ($1, $2, $3, $4)`,
          [registry, tree.root, TREE_DEPTH, regCredits.length],
        );
      }
    }

    return roots;
  }

  async getRoot(registry: string): Promise<string | null> {
    const tree = this.trees.get(registry);
    if (tree) return tree.root;

    if (this.db) {
      const result = await this.db.query<{ merkle_root: string }>(
        `SELECT merkle_root FROM merkle_snapshots WHERE registry = $1
         ORDER BY snapshot_at DESC LIMIT 1`,
        [registry],
      );
      return result.rows[0]?.merkle_root ?? null;
    }
    return null;
  }

  async getMerkleProof(creditHash: string): Promise<MerkleProof | null> {
    // Ensure trees are built
    if (this.trees.size === 0) {
      await this.rebuildTrees();
    }

    const location = this.creditHashIndex.get(creditHash);
    if (!location) return null;

    const tree = this.trees.get(location.registry);
    if (!tree) return null;

    return getMerkleProof(tree, location.index);
  }

  verifyProof(leaf: string, path: string[], indices: number[], root: string): boolean {
    let current = leaf;
    for (let i = 0; i < path.length; i++) {
      if (indices[i] === 0) {
        current = poseidon2Hash(current, path[i]);
      } else {
        current = poseidon2Hash(path[i], current);
      }
    }
    return current === root;
  }
}
