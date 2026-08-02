import { Injectable } from '@nestjs/common';

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

/** FNV-1a based deterministic 64-hex hash of the credit id. */
function deterministicCreditHash(creditId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < creditId.length; i++) {
    h ^= creditId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const base = h.toString(16).padStart(8, '0');
  return `0x${base.repeat(8)}`;
}

@Injectable()
export class RegistryService {
  private readonly mockCredits: Credit[] = [
    ...Array.from({ length: 10 }, (_, i) => {
      const creditId = `VCS-${String(i + 1).padStart(3, '0')}`;
      return {
        creditId,
        registry: 'Verra' as const,
        registryId: 1,
        vintage: 2020 + (i % 5),
        methodology: METHODOLOGIES[(i % 4) + 1],
        methodologyCode: (i % 4) + 1,
        volume: (i + 1) * 1000,
        permanenceRating: 70 + (i % 30),
        creditHash: deterministicCreditHash(creditId),
        isRetired: false,
      };
    }),
    ...Array.from({ length: 5 }, (_, i) => {
      const creditId = `GS-${String(i + 1).padStart(3, '0')}`;
      return {
        creditId,
        registry: 'GoldStandard' as const,
        registryId: 2,
        vintage: 2021 + (i % 4),
        methodology: METHODOLOGIES[(i % 2) + 5],
        methodologyCode: (i % 2) + 5,
        volume: (i + 3) * 500,
        permanenceRating: 80 + (i % 15),
        creditHash: deterministicCreditHash(creditId),
        isRetired: false,
      };
    }),
  ];

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
