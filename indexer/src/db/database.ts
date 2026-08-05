import { Client } from 'pg';

/**
 * Shared PostgreSQL access for the indexer with idempotent schema setup.
 * The same tables are used by the backend; this module only adds the
 * indexer-specific state and dedupe tables plus the constraints that keep
 * re-processing safe.
 */
export class Database {
  client: Client | null = null;
  connected = false;

  async connect(): Promise<boolean> {
    if (this.connected && this.client) return true;

    try {
      this.client = new Client({
        connectionString:
          process.env.DATABASE_URL ||
          'postgres://nullcarbon:nullcarbon@localhost:5432/nullcarbon',
      });
      await this.client.connect();
      await this.ensureSchema();
      this.connected = true;
      console.log('Indexer connected to PostgreSQL');
      return true;
    } catch (err) {
      console.warn('PostgreSQL not available — indexer running in memory-only mode', err);
      this.connected = false;
      this.client = null;
      return false;
    }
  }

  async ensureSchema(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS indexer_state (
        namespace VARCHAR(64) PRIMARY KEY,
        last_ledger BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS indexer_events (
        event_id VARCHAR(255) PRIMARY KEY,
        namespace VARCHAR(64) NOT NULL,
        processed_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_events_idempotent
        ON indexer_events(event_id, namespace);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_nullifier_unique
        ON retirement_certificates(nullifier);
    `;
    await this.client!.query(sql);
  }

  /** Last fully-processed ledger for a handler namespace. */
  async getLastLedger(namespace: string): Promise<number> {
    if (!this.client) return 0;
    const result = await this.client.query(
      'SELECT last_ledger FROM indexer_state WHERE namespace = $1',
      [namespace],
    );
    return parseInt(result.rows[0]?.last_ledger ?? '0', 10);
  }

  async setLastLedger(namespace: string, ledger: number): Promise<void> {
    if (!this.client) return;
    await this.client.query(
      `INSERT INTO indexer_state (namespace, last_ledger, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (namespace) DO UPDATE SET last_ledger = $2, updated_at = NOW()`,
      [namespace, ledger],
    );
  }

  /** Record a processed event id; returns false when already processed. */
  async markProcessed(namespace: string, eventId: string): Promise<boolean> {
    if (!this.client) return true;
    const result = await this.client.query(
      `INSERT INTO indexer_events (event_id, namespace, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (event_id, namespace) DO NOTHING`,
      [eventId, namespace],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async query<R = any>(text: string, params?: unknown[]): Promise<R[]> {
    if (!this.client) return [];
    const result = await this.client.query(text, params);
    return result.rows as R[];
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.connected = false;
      this.client = null;
    }
  }
}
