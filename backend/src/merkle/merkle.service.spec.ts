import { ConfigService } from '@nestjs/config';
import { MerkleService } from './merkle.service';
import { RegistryService } from '../registry/registry.service';

describe('MerkleService', () => {
  let service: MerkleService;
  let registry: RegistryService;

  beforeEach(async () => {
    registry = new RegistryService();
    service = new MerkleService(new ConfigService(), registry);
    await service.rebuildTrees();
  });

  it('builds a distinct root per registry', async () => {
    const verraRoot = await service.getRoot('Verra');
    const gsRoot = await service.getRoot('GoldStandard');
    expect(verraRoot).toBeTruthy();
    expect(gsRoot).toBeTruthy();
    expect(verraRoot).not.toBe(gsRoot);
  });

  it('produces a self-verifying proof for every credit', async () => {
    const credits = await registry.getCredits();
    expect(credits.length).toBeGreaterThan(0);

    for (const credit of credits) {
      const proof = await service.getMerkleProof(credit.creditHash);
      expect(proof).not.toBeNull();
      if (proof) {
        expect(
          service.verifyProof(
            proof.creditHash,
            proof.merklePath,
            proof.merkleIndices,
            proof.root,
          ),
        ).toBe(true);
      }
    }
  });

  it('rejects a proof with a tampered leaf', async () => {
    const [credit] = await registry.getCredits();
    const proof = await service.getMerkleProof(credit.creditHash);
    expect(proof).not.toBeNull();

    if (proof) {
      const forgedLeaf = `0x${'0'.repeat(64)}`;
      expect(
        service.verifyProof(
          forgedLeaf,
          proof.merklePath,
          proof.merkleIndices,
          proof.root,
        ),
      ).toBe(false);
    }
  });

  it('rejects a proof against the wrong root', async () => {
    const [credit] = await registry.getCredits();
    const proof = await service.getMerkleProof(credit.creditHash);
    expect(proof).not.toBeNull();

    if (proof) {
      expect(
        service.verifyProof(
          proof.creditHash,
          proof.merklePath,
          proof.merkleIndices,
          `0x${'0'.repeat(64)}`,
        ),
      ).toBe(false);
    }
  });

  it('returns null for an unknown credit hash', async () => {
    const proof = await service.getMerkleProof(`0x${'f'.repeat(64)}`);
    expect(proof).toBeNull();
  });
});
