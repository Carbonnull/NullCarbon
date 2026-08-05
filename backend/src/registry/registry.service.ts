import { Injectable } from '@nestjs/common';
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

  constructor(private readonly crypto: CryptoService) {
    this.mockCredits = this.buildMockCredits();
  }

  /** Deterministic Poseidon credit leaf hash (mirrors the Noir circuit). */
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

  async syncRegistry(): Promise<Credit[]> {
    return this.mockCredits;
  }

  async getCredits(filters?: {
    registry?: string;
    vintageMin?: number;
    vintageMax?: number;
    methodology?: string;
    volumeMin?: number;
  }): Promise<Credit[]> {
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
    return credits;
  }

  async getCreditById(creditId: string): Promise<Credit | null> {
    return this.mockCredits.find((c) => c.creditId === creditId) || null;
  }

  async getCreditByHash(hash: string): Promise<Credit | null> {
    return this.mockCredits.find((c) => c.creditHash === hash) || null;
  }

  async markRetired(creditId: string): Promise<void> {
    const credit = this.mockCredits.find((c) => c.creditId === creditId);
    if (credit) {
      credit.isRetired = true;
    }
  }
}
