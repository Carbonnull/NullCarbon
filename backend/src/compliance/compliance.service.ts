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

    const size = Math.min(
      Math.pow(2, Math.ceil(Math.log2(nullifiers.length))),
      Math.pow(2, TREE_DEPTH),
    );
    let layer = [...nullifiers];
    const zero = this.crypto.zeroHashAt(0);
    while (layer.length < size) {
      layer.push(zero);
    }

    let builtLevels = 0;
    while (layer.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(this.crypto.merkleHash(layer[i], layer[i + 1]));
      }
      layer = next;
      builtLevels++;
    }

    // Fold the built root up through the empty remainder of the tree, the
    // same way MerkleService folds registry roots to full depth.
    let fullRoot = layer[0];
    for (let level = builtLevels; level < TREE_DEPTH; level++) {
      fullRoot = this.crypto.merkleHash(fullRoot, this.crypto.zeroHashAt(level));
    }
    return fullRoot;
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
      this.crypto.toField(companySecret),
      this.crypto.fieldFromLabel(periodId),
    );

    return {
      nullifiers: verified,
      periodId,
      nullifierSetRoot,
      complianceNullifier,
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
