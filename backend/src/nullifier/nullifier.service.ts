import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { StellarRpcService } from '../stellar/stellar.rpc.service';

@Injectable()
export class NullifierService {
  // In-memory fallback when DB is unavailable
  private usedNullifiers = new Set<string>();
  private readonly nullifierRegistryId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly stellar: StellarRpcService,
    @Optional() @Inject('PG_POOL') private readonly db?: Pool,
  ) {
    this.nullifierRegistryId = config.get('NULLIFIER_REGISTRY_ID') || '';
  }

  async isUsed(nullifier: string): Promise<boolean> {
    // Fast path: in-memory
    if (this.usedNullifiers.has(nullifier)) return true;

    // DB check
    if (this.db) {
      const result = await this.db.query<{ id: number }>(
        'SELECT id FROM nullifiers WHERE nullifier = $1 LIMIT 1',
        [nullifier],
      );
      if (result.rowCount && result.rowCount > 0) {
        this.usedNullifiers.add(nullifier);
        return true;
      }
    }

    // On-chain check (source of truth)
    if (this.nullifierRegistryId) {
      const onChain = await this.checkOnChain(nullifier);
      if (onChain) {
        this.usedNullifiers.add(nullifier);
        return true;
      }
    }

    return false;
  }

  async record(
    nullifier: string,
    corridorId: string,
    txHash: string,
  ): Promise<void> {
    this.usedNullifiers.add(nullifier);

    if (this.db) {
      await this.db.query(
        `INSERT INTO nullifiers (nullifier, corridor_id, stellar_tx_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (nullifier) DO NOTHING`,
        [nullifier, corridorId, txHash],
      );
    }
  }

  async getCount(): Promise<number> {
    if (this.db) {
      const result = await this.db.query<{ count: string }>(
        'SELECT COUNT(*) FROM nullifiers',
      );
      return parseInt(result.rows[0].count, 10);
    }
    return this.usedNullifiers.size;
  }

  /**
   * Check the NullifierRegistry contract (the on-chain source of truth) for
   * whether a nullifier has been recorded via NullifierRegistry::is_used.
   */
  private async checkOnChain(nullifier: string): Promise<boolean> {
    try {
      const used = await this.stellar.readContract(
        this.nullifierRegistryId,
        'is_used',
        [StellarRpcService.bytes32Arg(nullifier)],
      );
      return used === true;
    } catch (err) {
      console.warn(`On-chain nullifier check failed for ${nullifier.slice(0, 16)}...:`, err);
      return false;
    }
  }
}
