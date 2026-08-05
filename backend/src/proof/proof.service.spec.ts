import { ConfigService } from '@nestjs/config';
import { ProofService } from './proof.service';
import { NullifierService } from '../nullifier/nullifier.service';
import { CertificateService } from '../certificate/certificate.service';
import { StellarRpcService } from '../stellar/stellar.rpc.service';

describe('ProofService', () => {
  const config = new ConfigService({});
  const stellar = new StellarRpcService(config);

  let service: ProofService;
  let nullifierService: NullifierService;
  let certificateService: CertificateService;

  beforeEach(() => {
    nullifierService = new NullifierService(config, stellar, undefined);
    certificateService = new CertificateService(config, stellar, undefined);
    service = new ProofService(config, nullifierService, certificateService, undefined);
  });

  it('relays a retirement proof in dev mode and issues a certificate', async () => {
    const result = await service.relayRetirementProof('0xabcd', {
      nullifier: '0x' + '01'.repeat(32),
      registryMerkleRoot: '0x' + '02'.repeat(32),
      volumeCommitment: '0x' + '03'.repeat(32),
      corridorId: 'personal',
      minVintageYear: 2016,
      minPermanence: 70,
    });

    expect(result.verified).toBe(true);
    expect(result.txHash).toMatch(/^devtx_/);
    expect(result.certificateId).toBeTruthy();

    const cert = await certificateService.getByCertificateId(result.certificateId!);
    expect(cert?.nullifier).toBe('0x' + '01'.repeat(32));
  });

  it('rejects a retirement proof whose nullifier is already used', async () => {
    const inputs = {
      nullifier: '0x' + '02'.repeat(32),
      registryMerkleRoot: '0x',
      volumeCommitment: '0x',
      corridorId: 'personal',
      minVintageYear: 2016,
      minPermanence: 70,
    };
    await nullifierService.record(inputs.nullifier, 'personal', 'tx0');
    const result = await service.relayRetirementProof('0xabcd', inputs);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('already used');
  });

  it('relays a compliance proof and persists a COMP certificate', async () => {
    const result = await service.relayComplianceProof('0xabcd', {
      commitmentThreshold: 10000,
      periodId: '2025-Q1',
      complianceNullifier: '0x' + '04'.repeat(32),
      nullifierSetRoot: '0x' + '05'.repeat(32),
    });

    expect(result.compliant).toBe(true);
    expect(result.complianceCertificateId).toBeTruthy();
    const cert = await certificateService.getByCertificateId(result.complianceCertificateId!);
    expect(cert?.corridorId).toBe('compliance:2025-Q1');
  });

  it('rejects a compliance proof whose nullifier is already used', async () => {
    const nullifier = '0x' + '06'.repeat(32);
    await nullifierService.record(nullifier, 'compliance:2025-Q1', 'tx0');
    const result = await service.relayComplianceProof('0xabcd', {
      commitmentThreshold: 10000,
      periodId: '2025-Q1',
      complianceNullifier: nullifier,
      nullifierSetRoot: '0x' + '05'.repeat(32),
    });
    expect(result.compliant).toBe(false);
  });
});
