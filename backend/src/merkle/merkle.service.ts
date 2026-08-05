import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { RegistryService, Credit } from '../registry/registry.service';
import { CryptoService, TREE_DEPTH } from '../crypto/crypto.service';

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

// Root of a fully-empty subtree of each height. ZERO_HASHES[h] is the root
// of 2^h zero leaves, so the sibling of a node covering 2^h leaves that
// lies outside the built tree is ZERO_HASHES[h]. Precomputed so proofs and
// the full-depth root can be derived without materializing the whole
// 2^TREE_DEPTH tree. Uses the same construction as the Noir circuits.
@Injectable()
export class MerkleService {
  private trees = new Map<string, MerkleTree>();
  // creditHash → leaf index in tree
  private creditHashIndex = new Map<string, { registry: string; index: number }>();

  private readonly zeroHashes: string[];

  constructor(
    private readonly config: ConfigService,
    private readonly registryService: RegistryService,
    private readonly crypto: CryptoService,
    @Optional() @Inject('PG_POOL') private readonly db?: Pool,
  ) {
    this.zeroHashes = Array.from(
      { length: TREE_DEPTH + 1 },
      (_, level) => this.crypto.zeroHashAt(level),
    );
  }

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
      // Leaves are the Poseidon credit leaf hashes computed by the registry,
      // which mirror `merkle::compute_leaf_hash` in the circuits.
      const leaves = regCredits.map((c) => c.creditHash);

      const tree = this.buildMerkleTree(leaves);
      this.trees.set(registry, tree);

      // Update creditHash index
      regCredits.forEach((c, i) => {
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

    return this.getMerkleProofFromTree(tree, location.index);
  }

  verifyProof(leaf: string, path: string[], indices: number[], root: string): boolean {
    let current = leaf;
    for (let i = 0; i < path.length; i++) {
      if (indices[i] === 0) {
        current = this.crypto.merkleHash(current, path[i]);
      } else {
        current = this.crypto.merkleHash(path[i], current);
      }
    }
    return current === root;
  }

  /** Compute the root for a given set of (already Poseidon-hashed) leaves. */
  computeRoot(leaves: string[]): string {
    return this.buildMerkleTree(leaves).root;
  }

  /** Compute the full-depth root by folding an arbitrary root up the tree. */
  foldToDepth(root: string, builtLevels: number): string {
    let fullRoot = root;
    for (let level = builtLevels; level < TREE_DEPTH; level++) {
      fullRoot = this.crypto.merkleHash(fullRoot, this.zeroHashes[level]);
    }
    return fullRoot;
  }

  private buildMerkleTree(leaves: string[]): MerkleTree {
    // Only build the smallest power-of-two tree that fits the leaves instead
    // of the full 2^TREE_DEPTH tree: a 2^20 build is ~2M hashes per registry.
    const leafCount = Math.max(1, leaves.length);
    const paddedSize = Math.min(
      Math.pow(2, Math.ceil(Math.log2(leafCount))),
      Math.pow(2, TREE_DEPTH),
    );
    const paddedLeaves = [...leaves];
    while (paddedLeaves.length < paddedSize) {
      paddedLeaves.push(this.zeroHashes[0]);
    }

    const nodes: string[][] = [paddedLeaves];
    let current = paddedLeaves;

    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        next.push(this.crypto.merkleHash(current[i], current[i + 1]));
      }
      nodes.push(next);
      current = next;
    }

    // Fold the built root up through the empty remainder of the tree so the
    // returned root matches what a full-depth tree would produce.
    const builtLevels = nodes.length - 1;
    const fullRoot = this.foldToDepth(current[0], builtLevels);

    return {
      root: fullRoot,
      leaves: paddedLeaves,
      nodes,
      depth: TREE_DEPTH,
    };
  }

  private getMerkleProofFromTree(tree: MerkleTree, leafIndex: number): MerkleProof {
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
          : this.zeroHashes[level];
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
}
