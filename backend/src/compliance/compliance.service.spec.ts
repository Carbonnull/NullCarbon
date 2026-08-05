import { ConfigService } from '@nestjs/config';
import { ComplianceService } from './compliance.service';
import { NullifierService } from '../nullifier/nullifier.service';
import { CertificateService } from '../certificate/certificate.service';
import { CryptoService } from '../crypto/crypto.service';
import { StellarRpcService } from '../stellar/stellar.rpc.service';

describe('ComplianceService', () => {
  const config = new ConfigService({});
  const crypto = new CryptoService();

  let service: ComplianceService;
  let nullifierService: NullifierService;
  let certificateService: CertificateService;

  beforeEach(() => {
    const stellar = new StellarRpcService(config);
    nullifierService = new NullifierService(config, stellar, undefined);
    certificateService = new CertificateService(config, stellar, undefined);
    service = new ComplianceService(nullifierService, certificateService, crypto);
  });

  it('computes a deterministic nullifier set root', () => {
    const nullifiers = ['0x' + '01'.repeat(32), '0x' + '02'.repeat(32)];
    expect(service.computeNullifierSetRoot(nullifiers)).toBe(
      service.computeNullifierSetRoot(nullifiers),
    );
    expect(service.computeNullifierSetRoot(nullifiers)).not.toBe(
      service.computeNullifierSetRoot(nullifiers.slice(0, 1)),
    );
  });

  it('root of a single nullifier differs from the nullifier itself', () => {
    const n = '0x' + '03'.repeat(32);
    const root = service.computeNullifierSetRoot([n]);
    expect(root).not.toBe(n);
  });

  it('matches the in-circuit zero-root convention for an empty set', () => {
    // Empty set → the zero leaf (hash4 of [0,0,0,0]) before folding.
    expect(service.computeNullifierSetRoot([])).toBe(crypto.zeroHashAt(0));
  });

  it('produces a consistent compliance nullifier', () => {
    const claim1 = service.generateComplianceClaim([], '2025-Q1', 'abc');
    const claim2 = service.generateComplianceClaim([], '2025-Q1', 'abc');
    return Promise.all([claim1, claim2]).then(([a, b]) => {
      expect(a.complianceNullifier).toBe(b.complianceNullifier);
      expect(a.complianceNullifier).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  it('reports non-compliant when no claims exist', async () => {
    const status = await service.getComplianceStatus('company-1');
    expect(status.compliant).toBe(false);
  });

  it('reports compliant after a compliance claim is recorded', async () => {
    await certificateService.addCertificate(
      {
        nullifier: '0x' + 'aa'.repeat(32),
        corridorId: 'compliance:2025-Q1',
        verifiable: true,
        timestamp: new Date().toISOString(),
      },
      'COMP',
    );
    const status = await service.getComplianceStatus('company-1');
    expect(status.compliant).toBe(true);
    expect(status.periodId).toBe('2025-Q1');
  });
});
