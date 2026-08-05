import { Database } from '../db/database';
import { StellarEvent } from './stellar.events';

const NAMESPACE = 'nullifier';

/**
 * Indexes `nullified` events from the NullifierRegistry contract:
 *
 *   topics: [symbol "nullified", bytes nullifier]
 *
 * Used for compliance-claim nullifiers that are recorded without a
 * retirement certificate. Idempotent via event-id dedupe and the unique
 * nullifier index.
 */
export class NullifierHandler {
  constructor(private readonly db: Database) {}

  async handle(event: StellarEvent): Promise<void> {
    const nullifier = event.topics[1] ?? '';
    if (!nullifier) {
      console.warn(`nullifier: skipping event without nullifier (${event.id})`);
      return;
    }

    const alreadySeen = await this.db.markProcessed(NAMESPACE, event.id);
    if (!alreadySeen) {
      console.log(`nullifier: skipping already-processed event ${event.id}`);
      return;
    }

    try {
      await this.db.query(
        `INSERT INTO nullifiers (nullifier, corridor_id, stellar_tx_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (nullifier) DO NOTHING`,
        [nullifier, 'compliance', event.txHash],
      );
      console.log(
        `nullifier: indexed ${nullifier.slice(0, 16)}... | ledger ${event.ledger}`,
      );
    } catch (err) {
      console.error(`nullifier: failed to index event ${event.id}:`, err);
    }
  }
}
