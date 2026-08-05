import { Injectable } from '@nestjs/common';
import { NullifierService } from '../nullifier/nullifier.service';
import { CertificateService } from '../certificate/certificate.service';
import { CryptoService, TREE_DEPTH } from '../crypto/crypto.service';

export interface ComplianceClaim {
  nullifiers: string[];
  periodId: string;
  nullifierSetRoot: string;
  complianceNullifier?: string;
  totalVolume?: number;
  nullifierPaths?: string[][];
  nullifierIndices?: number[][];
}

export interface NullifierSetTree {
  root: string;
  leaves: string[];
  nodes: string[][];
  depth: number;
}

export interface ComplianceStatus {
  compliant: boolean;
  periodId?: string;
  verifiedAt?: string;
  certificateId?: string;
}

@Injectable()
export class ComplianceService {
  constructor(
    private readonly nullifierService: NullifierService,
    private readonly certificateService: CertificateService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Merkle root of a nullifier set using the same Poseidon pair hashing as
   * the registry trees (`CryptoService.merkleHash`), padded to the next
   * power of two with the empty-subtree root. This matches what the
   * compliance circuit verifies against its `nullifier_set_root` input.
   */
  computeNullifierSetRoot(nullifiers: string[]): string {
    if (nullifiers.length === 0) return this.crypto.zeroHashAt(0);
    return this.buildNullifierSetTree(nullifiers).root;
  }

  /**
   * Inclusion proof for a single nullifier inside the nullifier-set tree,
   * matching what the compliance circuit's `nullifier_paths`/`nullifier_indices`
   * expect (index 0 = left, 1 = right, sibling at level h of an out-of-range
   * node is the empty-subtree root `zeroHashAt(h)`).
   */
  computeNullifierSetProof(
    nullifiers: string[],
    nullifier: string,
  ): { merklePath: string[]; merkleIndices: number[] } | null {
    if (nullifiers.length === 0) return null;
    const tree = this.buildNullifierSetTree(nullifiers);
    const leafIndex = tree.leaves.indexOf(nullifier);
    if (leafIndex === -1) return null;

    const merklePath: string[] = [];
    const merkleIndices: number[] = [];
    let idx = leafIndex;
    for (let level = 0; level < tree.depth; level++) {
      const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
      const levelNodes = tree.nodes[level];
      const siblingNode =
        levelNodes && sibling < levelNodes.length
          ? levelNodes[sibling]
          : this.crypto.zeroHashAt(level);
      merklePath.push(siblingNode);
      merkleIndices.push(idx % 2);
      idx = Math.floor(idx / 2);
    }
    return { merklePath, merkleIndices };
  }

  private buildNullifierSetTree(nullifiers: string[]): NullifierSetTree {
    const size = Math.min(
      Math.pow(2, Math.ceil(Math.log2(nullifiers.length))),
      Math.pow(2, TREE_DEPTH),
    );
    const leaves = [...nullifiers];
    const zero = this.crypto.zeroHashAt(0);
    while (leaves.length < size) {
      leaves.push(zero);
    }

    const nodes: string[][] = [leaves];
    let layer = leaves;
    let builtLevels = 0;
    while (layer.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(this.crypto.merkleHash(layer[i], layer[i + 1]));
      }
      nodes.push(next);
      layer = next;
      builtLevels++;
    }

    // Fold the built root up through the empty remainder of the tree, the
    // same way MerkleService folds registry roots to full depth.
    let fullRoot = layer[0];
    for (let level = builtLevels; level < TREE_DEPTH; level++) {
      fullRoot = this.crypto.merkleHash(fullRoot, this.crypto.zeroHashAt(level));
    }
    return { root: fullRoot, leaves, nodes, depth: TREE_DEPTH };
  }

  async generateComplianceClaim(
    nullifiers: string[],
    periodId: string,
    companySecret: string,
  ): Promise<ComplianceClaim> {
    // Verify each nullifier is recorded on-chain
    const verified: string[] = [];
    for (const n of nullifiers) {
      if (await this.nullifierService.isUsed(n)) {
        verified.push(n);
      }
    }

    const nullifierSetRoot = this.computeNullifierSetRoot(verified);
    const complianceNullifier = this.crypto.computeComplianceNullifier(
      // Company secrets are ASCII labels, encoded exactly like period ids.
      this.crypto.fieldFromLabel(companySecret),
      this.crypto.fieldFromLabel(periodId),
    );

    const nullifierPaths: string[][] = [];
    const nullifierIndices: number[][] = [];
    for (const n of verified) {
      const proof = this.computeNullifierSetProof(verified, n);
      nullifierPaths.push(proof?.merklePath ?? []);
      nullifierIndices.push(proof?.merkleIndices ?? []);
    }

    return {
      nullifiers: verified,
      periodId,
      nullifierSetRoot,
      complianceNullifier,
      nullifierPaths,
      nullifierIndices,
    };
  }

  async getComplianceStatus(companyId: string): Promise<ComplianceStatus> {
    const claims = await this.certificateService.findComplianceClaims();
    if (claims.length > 0) {
      const latest = claims[0];
      const periodId = (latest.corridorId ?? '').slice('compliance:'.length);
      return {
        compliant: true,
        periodId: periodId || companyId,
        verifiedAt: latest.timestamp,
        certificateId: latest.certificateId,
      };
    }
    return { compliant: false };
  }
}
