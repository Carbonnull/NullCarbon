import { RegistryService } from './registry.service';

describe('RegistryService', () => {
  let service: RegistryService;

  beforeEach(() => {
    service = new RegistryService();
  });

  it('returns all mock credits', async () => {
    const credits = await service.getCredits();
    expect(credits.length).toBe(15);
  });

  it('filters by registry', async () => {
    const credits = await service.getCredits({ registry: 'Verra' });
    expect(credits.length).toBe(10);
    expect(credits.every((c) => c.registry === 'Verra')).toBe(true);
  });

  it('filters by vintage range', async () => {
    const credits = await service.getCredits({
      vintageMin: 2023,
      vintageMax: 2024,
    });
    expect(credits.length).toBeGreaterThan(0);
    expect(credits.every((c) => c.vintage >= 2023 && c.vintage <= 2024)).toBe(true);
  });

  it('filters by methodology', async () => {
    const credits = await service.getCredits({ methodology: 'REDD+' });
    expect(credits.length).toBeGreaterThan(0);
    expect(credits.every((c) => c.methodology === 'REDD+')).toBe(true);
  });

  it('filters by minimum volume', async () => {
    const credits = await service.getCredits({ volumeMin: 5000 });
    expect(credits.length).toBeGreaterThan(0);
    expect(credits.every((c) => c.volume >= 5000)).toBe(true);
  });

  it('returns deterministic credit hashes across instances', async () => {
    const first = await new RegistryService().getCredits();
    const second = await new RegistryService().getCredits();
    first.forEach((c, i) => expect(c.creditHash).toBe(second[i].creditHash));
  });

  it('marks a credit as retired', async () => {
    const [credit] = await service.getCredits();
    await service.markRetired(credit.creditId);
    const retired = await service.getCreditByHash(credit.creditHash);
    expect(retired?.isRetired).toBe(true);
  });

  it('returns null for an unknown credit hash', async () => {
    const credit = await service.getCreditByHash(`0x${'f'.repeat(64)}`);
    expect(credit).toBeNull();
  });
});
