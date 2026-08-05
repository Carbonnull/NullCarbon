import { Database } from '../db/database';
import { StellarEvent } from './stellar.events';

const NAMESPACE = 'retirement';

/**
 * Indexes `retired` events from the RetirementVerifier contract:
 *
 *   topics: [symbol "retired", bytes nullifier, bytes volume_commitment,
 *            bytes corridor_id]
 *
 * Each event records the used nullifier and issues the on-chain retirement
 * certificate row. Idempotency is guaranteed by the shared event-id dedupe
 * table plus the unique nullifier index on retirement_certificates.
 */
export class RetirementHandler {
  constructor(private readonly db: Database) {}

  async handle(event: StellarEvent): Promise<void> {
    const nullifier = event.topics[1] ?? '';
    if (!nullifier) {
      console.warn(`retirement: skipping event without nullifier (${event.id})`);
      return;
    }

    const alreadySeen = await this.db.markProcessed(NAMESPACE, event.id);
    if (!alreadySeen) {
      console.log(`retirement: skipping already-processed event ${event.id}`);
      return;
    }

    const volumeCommitment = event.topics[2] ?? null;
    const corridorId = event.topics[3] ?? null;
    const certificateId = this.generateCertificateId(event.txHash);

    try {
      await this.db.query(
        `INSERT INTO nullifiers (nullifier, corridor_id, stellar_tx_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (nullifier) DO NOTHING`,
        [nullifier, corridorId, event.txHash],
      );

      await this.db.query(
        `INSERT INTO retirement_certificates
           (certificate_id, nullifier, volume_commitment, corridor_id,
            stellar_tx_hash, ledger, issued_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (certificate_id) DO NOTHING
         ON CONFLICT (nullifier) DO NOTHING`,
        [
          certificateId,
          nullifier,
          volumeCommitment,
          corridorId,
          event.txHash,
          event.ledger,
        ],
      );

      console.log(
        `retirement: indexed ${certificateId} | ${nullifier.slice(0, 16)}... | ledger ${event.ledger}`,
      );
    } catch (err) {
      console.error(`retirement: failed to index event ${event.id}:`, err);
    }
  }

  private generateCertificateId(txHash: string): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const suffix = (txHash || '').replace(/^0x/, '').slice(0, 8) || Math.floor(Math.random() * 1e6).toString(16);
    return `CERT-${dateStr}-${suffix}`;
  }
}
