import { Injectable, Inject, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { CryptoService } from '../crypto/crypto.service';

export interface Credit {
  creditId: string;
  registry: string;
  registryId: number;
  vintage: number;
  methodology: string;
  methodologyCode: number;
  volume: number;
  permanenceRating: number;
  creditHash: string;
  isRetired: boolean;
}

export interface CreditFilters {
  registry?: string;
  vintageMin?: number;
  vintageMax?: number;
  methodology?: string;
  volumeMin?: number;
}

export interface CreditPage {
  credits: Credit[];
  total: number;
  limit: number;
  offset: number;
}

const METHODOLOGIES: Record<number, string> = {
  1: 'REDD+',
  2: 'IFM',
  3: 'ARR',
  4: 'DAC',
  5: 'GS4GG',
  6: 'ICS',
};

@Injectable()
export class RegistryService {
  private mockCredits: Credit[] = [];

  constructor(
    private readonly crypto: CryptoService,
    @Optional() @Inject('PG_POOL') private readonly db?: Pool,
  ) {
    this.mockCredits = this.buildMockCredits();
  }

  private buildMockCredits(): Credit[] {
    const verra: Credit[] = Array.from({ length: 10 }, (_, i) => {
      const creditId = `VCS-${String(i + 1).padStart(3, '0')}`;
      return {
        creditId,
        registry: 'Verra',
        registryId: 1,
        vintage: 2020 + (i % 5),
        methodology: METHODOLOGIES[(i % 4) + 1],
        methodologyCode: (i % 4) + 1,
        volume: (i + 1) * 1000,
        permanenceRating: 70 + (i % 30),
        creditHash: '',
        isRetired: false,
      };
    });

    const goldStandard: Credit[] = Array.from({ length: 5 }, (_, i) => {
      const creditId = `GS-${String(i + 1).padStart(3, '0')}`;
      return {
        creditId,
        registry: 'GoldStandard',
        registryId: 2,
        vintage: 2021 + (i % 4),
        methodology: METHODOLOGIES[(i % 2) + 5],
        methodologyCode: (i % 2) + 5,
        volume: (i + 3) * 500,
        permanenceRating: 80 + (i % 15),
        creditHash: '',
        isRetired: false,
      };
    });

    return [...verra, ...goldStandard].map((credit) => ({
      ...credit,
      creditHash: this.crypto.computeCreditLeafHash(credit),
    }));
  }

  /**
   * Sync the registry source of truth into PostgreSQL when a pool is
   * available, then return all credits. The mock dataset stands in for the
   * external carbon registries (Verra / GoldStandard).
   */
  async syncRegistry(): Promise<Credit[]> {
    if (this.db) {
      for (const credit of this.mockCredits) {
        await this.db.query(
          `INSERT INTO credits
             (credit_id, registry, registry_id, credit_hash, vintage_year,
              methodology_code, methodology_name, permanence_rating, tonne_volume, is_retired)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (credit_id) DO UPDATE SET
             credit_hash = EXCLUDED.credit_hash,
             is_retired = credits.is_retired OR EXCLUDED.is_retired`,
          [
            credit.creditId,
            credit.registry,
            credit.registryId,
            credit.creditHash,
            credit.vintage,
            credit.methodologyCode,
            credit.methodology,
            credit.permanenceRating,
            credit.volume,
            credit.isRetired,
          ],
        );
      }
      return this.mapRows(
        (await this.db.query('SELECT * FROM credits ORDER BY credit_id')).rows,
      );
    }
    return this.mockCredits;
  }

  async getCredits(
    filters?: CreditFilters,
    pagination?: { limit?: number; offset?: number },
  ): Promise<CreditPage> {
    const limit = Math.min(Math.max(pagination?.limit ?? 50, 1), 100);
    const offset = Math.max(pagination?.offset ?? 0, 0);

    if (this.db) {
      const where: string[] = [];
      const params: unknown[] = [];
      const and = (clause: string, value: unknown) => {
        if (value !== undefined) {
          params.push(value);
          where.push(`${clause} $${params.length}`);
        }
      };
      and('registry =', filters?.registry);
      and('vintage_year >=', filters?.vintageMin);
      and('vintage_year <=', filters?.vintageMax);
      and('methodology_name =', filters?.methodology);
      and('tonne_volume >=', filters?.volumeMin);

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await this.db.query(
        `SELECT *, COUNT(*) OVER() AS total FROM credits ${whereSql}
         ORDER BY credit_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );
      return {
        credits: this.mapRows(result.rows),
        total: parseInt(result.rows[0]?.total ?? '0', 10),
        limit,
        offset,
      };
    }

    let credits = [...this.mockCredits];
    if (filters?.registry) {
      credits = credits.filter((c) => c.registry === filters.registry);
    }
    if (filters?.vintageMin) {
      credits = credits.filter((c) => c.vintage >= filters.vintageMin!);
    }
    if (filters?.vintageMax) {
      credits = credits.filter((c) => c.vintage <= filters.vintageMax!);
    }
    if (filters?.methodology) {
      credits = credits.filter((c) => c.methodology === filters.methodology);
    }
    if (filters?.volumeMin) {
      credits = credits.filter((c) => c.volume >= filters.volumeMin!);
    }
    return {
      credits: credits.slice(offset, offset + limit),
      total: credits.length,
      limit,
      offset,
    };
  }

  async getCreditById(creditId: string): Promise<Credit | null> {
    if (this.db) {
      const result = await this.db.query<DbCredit>(
        'SELECT * FROM credits WHERE credit_id = $1',
        [creditId],
      );
      return result.rows[0] ? this.mapRows([result.rows[0]])[0] : null;
    }
    return this.mockCredits.find((c) => c.creditId === creditId) || null;
  }

  async getCreditByHash(hash: string): Promise<Credit | null> {
    if (this.db) {
      const result = await this.db.query<DbCredit>(
        'SELECT * FROM credits WHERE credit_hash = $1',
        [hash],
      );
      return result.rows[0] ? this.mapRows([result.rows[0]])[0] : null;
    }
    return this.mockCredits.find((c) => c.creditHash === hash) || null;
  }

  async markRetired(creditId: string): Promise<void> {
    const credit = this.mockCredits.find((c) => c.creditId === creditId);
    if (credit) {
      credit.isRetired = true;
    }
    if (this.db) {
      await this.db.query(
        'UPDATE credits SET is_retired = true WHERE credit_id = $1',
        [creditId],
      );
    }
  }

  private mapRows(rows: DbCredit[]): Credit[] {
    return rows.map((row) => ({
      creditId: row.credit_id,
      registry: row.registry,
      registryId: row.registry_id,
      vintage: row.vintage_year,
      methodology: row.methodology_name ?? '',
      methodologyCode: row.methodology_code,
      volume: Number(row.tonne_volume),
      permanenceRating: row.permanence_rating,
      creditHash: row.credit_hash,
      isRetired: row.is_retired,
    }));
  }
}

interface DbCredit {
  credit_id: string;
  registry: string;
  registry_id: number;
  credit_hash: string;
  vintage_year: number;
  methodology_code: number;
  methodology_name?: string;
  permanence_rating: number;
  tonne_volume: string | number;
  is_retired: boolean;
}
