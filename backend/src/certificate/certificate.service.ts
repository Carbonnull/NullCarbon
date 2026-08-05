import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { StellarRpcService } from '../stellar/stellar.rpc.service';

export interface Certificate {
  certificateId: string;
  nullifier: string;
  registryRoot?: string;
  volumeCommitment?: string;
  corridorId?: string;
  timestamp?: string;
  stellarTxHash?: string;
  ledger?: number;
  verifiable: boolean;
}

@Injectable()
export class CertificateService {
  // In-memory fallback
  private certificates: Certificate[] = [];
  private sequence = 0;

  private readonly retirementVerifierId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly stellar: StellarRpcService,
    @Optional() @Inject('PG_POOL') private readonly db?: Pool,
  ) {
    this.retirementVerifierId = config.get('RETIREMENT_VERIFIER_ID') || '';
  }

  async getByCertificateId(id: string): Promise<Certificate | null> {
    if (this.db) {
      const result = await this.db.query<DbCert>(
        'SELECT * FROM retirement_certificates WHERE certificate_id = $1',
        [id],
      );
      if (result.rowCount && result.rowCount > 0)
        return this.mapRow(result.rows[0]);
    }
    return this.certificates.find((c) => c.certificateId === id) ?? null;
  }

  async getByNullifier(nullifier: string): Promise<Certificate | null> {
    if (this.db) {
      const result = await this.db.query<DbCert>(
        'SELECT * FROM retirement_certificates WHERE nullifier = $1 ORDER BY issued_at DESC LIMIT 1',
        [nullifier],
      );
      if (result.rowCount && result.rowCount > 0)
        return this.mapRow(result.rows[0]);
    }
    return this.certificates.find((c) => c.nullifier === nullifier) ?? null;
  }

  /**
   * Verify a retirement is recorded on-chain by reading
   * RetirementVerifier::get_retirement(nullifier). The contract persists a
   * record only after proof verification and nullifier registration, so a
   * present record is the source-of-truth confirmation.
   */
  async verifyOnChain(nullifier: string): Promise<boolean> {
    if (!this.retirementVerifierId) return false;
    try {
      const record = await this.stellar.readContract(
        this.retirementVerifierId,
        'get_retirement',
        [StellarRpcService.bytes32Arg(nullifier)],
      );
      return record != null;
    } catch (err) {
      console.warn(`On-chain verification failed for ${nullifier.slice(0, 16)}...:`, err);
      return false;
    }
  }

  async getPublicFeed(limit = 20, offset = 0): Promise<Certificate[]> {
    if (this.db) {
      const result = await this.db.query<DbCert>(
        'SELECT * FROM retirement_certificates ORDER BY issued_at DESC LIMIT $1 OFFSET $2',
        [limit, offset],
      );
      return result.rows.map(this.mapRow);
    }
    return this.certificates.slice(offset, offset + limit);
  }

  async findComplianceClaims(): Promise<Certificate[]> {
    if (this.db) {
      const result = await this.db.query<DbCert>(
        `SELECT * FROM retirement_certificates
         WHERE corridor_id LIKE 'compliance:%'
         ORDER BY issued_at DESC`,
      );
      return result.rows.map(this.mapRow);
    }
    return this.certificates.filter((c) =>
      c.corridorId?.startsWith('compliance:'),
    );
  }

  async addCertificate(
    cert: Omit<Certificate, 'certificateId'>,
    idPrefix = 'CERT',
  ): Promise<Certificate> {
    this.sequence++;
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const certId = `${idPrefix}-${dateStr}-${String(this.sequence).padStart(5, '0')}`;

    const certificate: Certificate = { ...cert, certificateId: certId };
    this.certificates.unshift(certificate);

    if (this.db) {
      await this.db.query(
        `INSERT INTO retirement_certificates
         (certificate_id, nullifier, registry_root, volume_commitment, corridor_id, stellar_tx_hash, ledger)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (certificate_id) DO NOTHING`,
        [
          certId,
          cert.nullifier,
          cert.registryRoot ?? null,
          cert.volumeCommitment ?? null,
          cert.corridorId ?? null,
          cert.stellarTxHash ?? null,
          cert.ledger ?? null,
        ],
      );
    }

    return certificate;
  }

  private mapRow(row: DbCert): Certificate {
    return {
      certificateId: row.certificate_id,
      nullifier: row.nullifier,
      registryRoot: row.registry_root ?? undefined,
      volumeCommitment: row.volume_commitment ?? undefined,
      corridorId: row.corridor_id ?? undefined,
      timestamp: row.issued_at?.toISOString(),
      stellarTxHash: row.stellar_tx_hash ?? undefined,
      ledger: row.ledger ?? undefined,
      verifiable: true,
    };
  }
}

interface DbCert {
  certificate_id: string;
  nullifier: string;
  registry_root?: string;
  volume_commitment?: string;
  corridor_id?: string;
  stellar_tx_hash?: string;
  ledger?: number;
  issued_at?: Date;
}
