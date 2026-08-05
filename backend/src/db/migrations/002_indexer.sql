-- Indexer support tables and constraints.
-- Shared by the backend relay and the TypeScript indexer so that writes
-- from either path are idempotent.

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

-- A nullifier can only ever be retired once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_nullifier_unique
  ON retirement_certificates(nullifier);
