import { TestBed } from '@angular/core/testing';
import { CryptoService, creditIdToField } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CryptoService],
    });
    service = TestBed.inject(CryptoService);
  });

  it('matches Noir hash_1', () => {
    expect(service.hash1(7n)).toBe(
      7061949393491957813657776856458368574501817871421526214197139795307327923534n,
    );
  });

  it('matches Noir hash_2', () => {
    expect(service.hash2(42n, 3000n)).toBe(
      9610127856663669817929490518548938844508328065540236751462180171428672856821n,
    );
    expect(service.hash2(1n, 1n)).toBe(
      217234377348884654691879377518794323857294947151490278790710809376325639809n,
    );
  });

  it('matches Noir hash_3', () => {
    expect(service.hash3(1n, 2n, 3n)).toBe(
      6542985608222806190361240322586112750744169038454362455181422643027100751666n,
    );
  });

  it('matches Noir hash_4 (credit leaf)', () => {
    expect(service.hash4(5n, 2022n, 3000n, 1n)).toBe(
      9439617725899025154321662299794564202029520407236897365040711136655645494281n,
    );
  });

  it('matches the in-circuit zero-leaf constant', () => {
    expect(service.hash4(0n, 0n, 0n, 0n)).toBe(
      2351654555892372227640888372176282444150254868378439619268573230312091195718n,
    );
  });

  it('computes hash_2 of the zero leaf recursively', () => {
    const z0 = service.zeroHashAt(0);
    const z1 = service.zeroHashAt(1);
    const z2 = service.zeroHashAt(2);
    expect(z0).toBe(
      service.computeCreditLeafHash({
        creditId: '',
        vintage: 0,
        volume: 0,
        methodologyCode: 0,
      }),
    );
    expect(z1).toBe(service.merkleHash(z0, z0));
    expect(z2).toBe(service.merkleHash(z1, z1));
  });

  it('creditIdToField is deterministic and field-safe', () => {
    const f = creditIdToField('VCS-001');
    expect(f).toBe(creditIdToField('VCS-001'));
    expect(f < service.fieldOrder).toBeTrue();
    expect(f > 0n).toBeTrue();
  });

  it('produces distinct leaves for distinct credits', () => {
    const a = service.computeCreditLeafHash({
      creditId: 'VCS-001',
      vintage: 2020,
      volume: 1000,
      methodologyCode: 1,
    });
    const b = service.computeCreditLeafHash({
      creditId: 'VCS-002',
      vintage: 2021,
      volume: 2000,
      methodologyCode: 2,
    });
    expect(a).not.toBe(b);
  });

  it('computes nullifiers and commitments consistently', () => {
    const n1 = service.computeRetirementNullifier(99n, 1n, 2n);
    const n2 = service.computeRetirementNullifier(99n, 1n, 2n);
    expect(n1).toBe(n2);
    expect(n1.startsWith('0x')).toBe(true);
    expect(service.computeVolumeCommitment(3000n, 99n)).toMatch(
      /^0x[0-9a-f]{64}$/,
    );
  });

  it('decodes labels deterministically', () => {
    const f = service.fieldFromLabel('2025-Q1');
    expect(f).toBe(service.fieldFromLabel('2025-Q1'));
    expect(f < service.fieldOrder).toBeTrue();
  });
});
