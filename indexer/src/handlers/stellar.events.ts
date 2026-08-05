export interface StellarEvent {
  /** Fully-qualified event id from Soroban RPC ("ledger:tx:op:event"). */
  id: string;
  contractId: string;
  topic0: string;
  topics: string[];
  ledger: number;
  txHash: string;
  raw: any;
}

/**
 * Decode a single Soroban RPC event topic. RPC topics are ScVal JSON
 * objects; we only need the shapes NullCarbon contracts publish:
 * symbols and 32-byte values.
 */
export function decodeTopic(topic: unknown): string {
  if (topic == null) return '';
  if (typeof topic === 'string') return topic;
  if (typeof topic === 'number') return String(topic);
  if (typeof topic === 'boolean') return topic ? 'true' : 'false';

  if (typeof topic === 'object') {
    const t = topic as Record<string, unknown>;
    if ('symbol' in t) return String(t.symbol);
    if ('string' in t) return String(t.string);
    if ('bytes' in t) return bytesToHex(t.bytes);
    if ('u64' in t) return String(t.u64);
    if ('i64' in t) return String(t.i64);
    if ('u128' in t) return String(t.u128);
    if ('i128' in t) return String(t.i128);
    if ('u32' in t) return String(t.u32);
    if ('i32' in t) return String(t.i32);
    if ('bool' in t) return t.bool ? 'true' : 'false';
    if ('vec' in t) return JSON.stringify(t.vec);
    if ('address' in t) return String((t.address as any)?.contract ?? (t.address as any)?.account ?? '');
  }
  return JSON.stringify(topic);
}

/** RPC bytes topics are base64-encoded; normalize to 0x-hex. */
function bytesToHex(value: unknown): string {
  if (typeof value !== 'string') return '';
  return '0x' + Buffer.from(value, 'base64').toString('hex');
}

/** Extract the transaction hash from an event id: "ledger:txhash:op:event". */
export function txHashFromEventId(eventId: string): string {
  const parts = eventId.split(':');
  return parts[1] ?? '';
}

/**
 * Normalize an event fetched from Soroban RPC into a StellarEvent. The raw
 * response shape is `{ id, ledger, topic, topics, contractId, type, ... }`
 * across RPC versions, so we accept both `topic` and `topics` fields.
 */
export function normalizeEvent(raw: any, contractId: string): StellarEvent {
  const topics = Array.isArray(raw.topics) ? raw.topics : Array.isArray(raw.topic) ? raw.topic : [];
  return {
    id: String(raw.id ?? ''),
    contractId,
    topic0: decodeTopic(topics[0]),
    topics: topics.map(decodeTopic),
    ledger: Number(raw.ledger ?? 0),
    txHash: txHashFromEventId(String(raw.id ?? '')) || String(raw.txHash ?? ''),
    raw,
  };
}
