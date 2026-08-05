import { ConfigService } from '@nestjs/config';
import { CertificateService } from './certificate.service';
import { StellarRpcService } from '../stellar/stellar.rpc.service';

describe('CertificateService', () => {
  const config = new ConfigService({});
  const stellar = new StellarRpcService(config);

  let service: CertificateService;

  beforeEach(() => {
    service = new CertificateService(config, stellar, undefined);
  });

  it('issues deterministic-format certificate ids', async () => {
    const cert = await service.addCertificate({
      nullifier: '0x' + '01'.repeat(32),
      registryRoot: '0x' + '02'.repeat(32),
      volumeCommitment: '0x' + '03'.repeat(32),
      corridorId: 'personal',
      verifiable: true,
      timestamp: new Date().toISOString(),
    });
    expect(cert.certificateId).toMatch(/^CERT-\d{8}-\d{5}$/);
  });

  it('looks up a certificate by id and nullifier', async () => {
    const cert = await service.addCertificate({
      nullifier: '0x' + 'ab'.repeat(32),
      corridorId: 'personal',
      verifiable: true,
    });
    expect((await service.getByCertificateId(cert.certificateId))?.certificateId).toBe(
      cert.certificateId,
    );
    expect((await service.getByNullifier(cert.nullifier))?.nullifier).toBe(cert.nullifier);
  });

  it('returns an ordered public feed with pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await service.addCertificate({
        nullifier: '0x' + i.toString(16).padStart(64, '0'),
        corridorId: 'personal',
        verifiable: true,
      });
    }
    const page = await service.getPublicFeed(2, 1);
    expect(page.length).toBe(2);
    // Newest first: the second added cert is the second in the feed order.
    expect(page[0].nullifier).toBe('0x' + (3).toString(16).padStart(64, '0'));
  });

  it('flags compliance claims for the status endpoint', async () => {
    await service.addCertificate({
      nullifier: '0x' + '11'.repeat(32),
      corridorId: 'compliance:2025-Q1',
      verifiable: true,
    });
    await service.addCertificate({
      nullifier: '0x' + '22'.repeat(32),
      corridorId: 'personal',
      verifiable: true,
    });
    const claims = await service.findComplianceClaims();
    expect(claims.length).toBe(1);
    expect(claims[0].corridorId).toBe('compliance:2025-Q1');
  });

  it('returns false from verifyOnChain when no verifier is configured', async () => {
    expect(await service.verifyOnChain('0x' + '01'.repeat(32))).toBe(false);
  });
});
