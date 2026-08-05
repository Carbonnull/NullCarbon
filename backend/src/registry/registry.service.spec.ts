import { RegistryService } from './registry.service';
import { CryptoService } from '../crypto/crypto.service';

describe('RegistryService', () => {
  let service: RegistryService;

  beforeEach(() => {
    service = new RegistryService(new CryptoService());
  });

  it('returns all mock credits', async () => {
    const { credits, total } = await service.getCredits();
    expect(credits.length).toBe(15);
    expect(total).toBe(15);
  });

  it('filters by registry', async () => {
    const { credits } = await service.getCredits({ registry: 'Verra' });
    expect(credits.length).toBe(10);
    expect(credits.every((c) => c.registry === 'Verra')).toBe(true);
  });

  it('filters by vintage range', async () => {
    const { credits } = await service.getCredits({
      vintageMin: 2023,
      vintageMax: 2024,
    });
    expect(credits.length).toBeGreaterThan(0);
    expect(credits.every((c) => c.vintage >= 2023 && c.vintage <= 2024)).toBe(true);
  });

  it('filters by methodology', async () => {
    const { credits } = await service.getCredits({ methodology: 'REDD+' });
    expect(credits.length).toBeGreaterThan(0);
    expect(credits.every((c) => c.methodology === 'REDD+')).toBe(true);
  });

  it('filters by minimum volume', async () => {
    const { credits } = await service.getCredits({ volumeMin: 5000 });
    expect(credits.length).toBeGreaterThan(0);
    expect(credits.every((c) => c.volume >= 5000)).toBe(true);
  });

  it('supports pagination with stable ordering', async () => {
    const { credits: page1 } = await service.getCredits({}, { limit: 5, offset: 0 });
    const { credits: page2 } = await service.getCredits({}, { limit: 5, offset: 5 });
    const { credits: page3 } = await service.getCredits({}, { limit: 5, offset: 10 });

    expect(page1.length).toBe(5);
    expect(page2.length).toBe(5);
    expect(page3.length).toBe(5);

    const ids = new Set([...page1, ...page2, ...page3].map((c) => c.creditId));
    expect(ids.size).toBe(15);
  });

  it('returns deterministic credit hashes across instances', async () => {
    const { credits: first } = await new RegistryService(new CryptoService()).getCredits();
    const { credits: second } = await new RegistryService(new CryptoService()).getCredits();
    first.forEach((c, i) => expect(c.creditHash).toBe(second[i].creditHash));
  });

  it('looks up credits by id and hash', async () => {
    const { credits } = await service.getCredits();
    const [credit] = credits;
    expect((await service.getCreditById(credit.creditId))?.creditId).toBe(credit.creditId);
    expect((await service.getCreditByHash(credit.creditHash))?.creditHash).toBe(credit.creditHash);
  });

  it('marks a credit as retired', async () => {
    const { credits } = await service.getCredits();
    const [credit] = credits;
    await service.markRetired(credit.creditId);
    const retired = await service.getCreditByHash(credit.creditHash);
    expect(retired?.isRetired).toBe(true);
  });

  it('returns null for an unknown credit hash', async () => {
    const credit = await service.getCreditByHash(`0x${'f'.repeat(64)}`);
    expect(credit).toBeNull();
  });
});
