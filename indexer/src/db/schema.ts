// NullCarbon Indexer — Database Schema Definitions
// This file serves as documentation for the expected PostgreSQL schema.
// Run these migrations manually or via the backend's migration system.

export const SCHEMA_SQL = `
-- Credits table: stores registry credit data
CREATE TABLE IF NOT EXISTS credits (
  id SERIAL PRIMARY KEY,
  credit_id VARCHAR(64) UNIQUE NOT NULL,
  registry VARCHAR(32) NOT NULL,
  registry_id INTEGER NOT NULL,
  credit_hash VARCHAR(66) NOT NULL,
  vintage_year INTEGER NOT NULL,
  methodology_code INTEGER NOT NULL,
  methodology_name VARCHAR(64),
  permanence_rating INTEGER NOT NULL,
  tonne_volume BIGINT NOT NULL,
  is_retired BOOLEAN DEFAULT false,
  stellar_token_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merkle snapshots: stores registry Merkle tree roots
CREATE TABLE IF NOT EXISTS merkle_snapshots (
  id SERIAL PRIMARY KEY,
  registry VARCHAR(32) NOT NULL,
  merkle_root VARCHAR(66) NOT NULL,
  depth INTEGER DEFAULT 20,
  credit_count INTEGER NOT NULL,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nullifiers table: records all used nullifiers
CREATE TABLE IF NOT EXISTS nullifiers (
  id SERIAL PRIMARY KEY,
  nullifier VARCHAR(66) UNIQUE NOT NULL,
  corridor_id VARCHAR(66),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  stellar_tx_hash VARCHAR(64)
);

-- Retirement certificates table: indexed certificate records
CREATE TABLE IF NOT EXISTS retirement_certificates (
  id SERIAL PRIMARY KEY,
  certificate_id VARCHAR(64) UNIQUE NOT NULL,
  nullifier VARCHAR(66) NOT NULL,
  registry_root VARCHAR(66),
  volume_commitment VARCHAR(66),
  corridor_id VARCHAR(66),
  stellar_tx_hash VARCHAR(64),
  ledger INTEGER,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexer cursor: last fully-processed ledger per event stream
CREATE TABLE IF NOT EXISTS indexer_state (
  namespace VARCHAR(64) PRIMARY KEY,
  last_ledger BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexer dedupe: processed event ids per stream (idempotency)
CREATE TABLE IF NOT EXISTS indexer_events (
  event_id VARCHAR(255) PRIMARY KEY,
  namespace VARCHAR(64) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- A nullifier can only ever be retired once
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_nullifier_unique
  ON retirement_certificates(nullifier);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nullifiers_nullifier ON nullifiers(nullifier);
CREATE INDEX IF NOT EXISTS idx_certificates_certificate_id ON retirement_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certificates_nullifier ON retirement_certificates(nullifier);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at ON retirement_certificates(issued_at DESC);
`;
