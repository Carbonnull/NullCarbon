import { Injectable } from '@nestjs/common';
import { NullifierService } from '../nullifier/nullifier.service';
import { CertificateService } from '../certificate/certificate.service';

export interface ComplianceClaim {
  nullifiers: string[];
  periodId: string;
  nullifierSetRoot: string;
  totalVolume?: number;
}

export interface ComplianceStatus {
  compliant: boolean;
  periodId?: string;
  verifiedAt?: string;
  certificateId?: string;
}

// Simple Merkle root of a nullifier set: hash pairs iteratively.
// Uses the same Poseidon2 approach as the backend Merkle service.
function computeNullifierSetRoot(nullifiers: string[]): string {
  if (nullifiers.length === 0) return '0x' + '0'.repeat(64);

  let layer = [...nullifiers];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const l = layer[i];
      const r = layer[i + 1] ?? l;
      // Simple deterministic combine for dev; production uses Poseidon2
      const combined = BigInt(l) ^ BigInt(r);
      next.push('0x' + combined.toString(16).padStart(64, '0'));
    }
    layer = next;
  }
  return layer[0];
}

@Injectable()
export class ComplianceService {
  constructor(
    private readonly nullifierService: NullifierService,
    private readonly certificateService: CertificateService,
  ) {}

  async generateComplianceClaim(
    nullifiers: string[],
    periodId: string,
    _companySecret: string,
  ): Promise<ComplianceClaim> {
    // Verify each nullifier is recorded on-chain
    const verified: string[] = [];
    for (const n of nullifiers) {
      if (await this.nullifierService.isUsed(n)) {
        verified.push(n);
      }
    }

    const nullifierSetRoot = computeNullifierSetRoot(verified);

    return {
      nullifiers: verified,
      periodId,
      nullifierSetRoot,
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
