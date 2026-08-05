import { Database } from '../db/database';
import { StellarEvent, normalizeEvent } from './stellar.events';

interface GetEventsResponse {
  result?: {
    events?: any[];
    latestLedger?: number;
  };
}

/**
 * Polls Soroban events for a contract's topic from a persistent cursor.
 * Events are identified by their RPC event id and de-duplicated through the
 * shared `indexer_events` table, so restarts never double-process.
 */
export class StellarEventSource {
  private requestId = 1;
  private cursor = 0;
  private cursorLoaded = false;

  constructor(
    private readonly rpcUrl: string,
    private readonly contractId: string,
    private readonly topic: string,
    private readonly namespace: string,
    private readonly db: Database,
  ) {}

  async poll(batchSize = 100): Promise<StellarEvent[]> {
    if (!this.contractId) {
      console.warn(`${this.namespace}: contract id not configured — skipping poll`);
      return [];
    }

    if (!this.cursorLoaded) {
      this.cursor = await this.db.getLastLedger(this.namespace);
      this.cursorLoaded = true;
      console.log(`${this.namespace}: resuming from ledger ${this.cursor}`);
    }

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'getEvents',
        params: {
          startLedger: Math.max(1, this.cursor),
          filters: [
            {
              type: 'contract',
              contractIds: [this.contractId],
              topics: [[{ symbol: this.topic }]],
            },
          ],
          pagination: { limit: batchSize },
        },
      }),
    });

    if (!response.ok) {
      console.warn(`${this.namespace}: getEvents returned ${response.status}`);
      return [];
    }

    const data = (await response.json()) as GetEventsResponse;
    const events: StellarEvent[] = [];

    for (const raw of data.result?.events ?? []) {
      const event = normalizeEvent(raw, this.contractId);
      if (event.topic0 !== this.topic) continue;
      events.push(event);
      if (event.ledger > this.cursor) {
        this.cursor = event.ledger;
      }
    }

    if (this.cursor > 0) {
      await this.db.setLastLedger(this.namespace, this.cursor);
    }

    return events;
  }
}
