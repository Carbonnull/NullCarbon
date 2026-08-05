import { ConfigService } from '@nestjs/config';
import { NullifierService } from './nullifier.service';
import { StellarRpcService } from '../stellar/stellar.rpc.service';

describe('NullifierService', () => {
  const config = new ConfigService({ NULLIFIER_REGISTRY_ID: 'CAAABBBCCC' });
  const stellar = new StellarRpcService(config);

  let service: NullifierService;

  beforeEach(() => {
    service = new NullifierService(config, stellar, undefined);
  });

  it('starts with no recorded nullifiers', async () => {
    expect(await service.isUsed('0x' + '01'.repeat(32))).toBe(false);
    expect(await service.getCount()).toBe(0);
  });

  it('records and recognizes a nullifier', async () => {
    const nullifier = '0x' + 'ab'.repeat(32);
    await service.record(nullifier, 'personal', 'tx1');
    expect(await service.isUsed(nullifier)).toBe(true);
    expect(await service.getCount()).toBe(1);
  });

  it('does not double count duplicate nullifiers', async () => {
    const nullifier = '0x' + 'cd'.repeat(32);
    await service.record(nullifier, 'personal', 'tx1');
    await service.record(nullifier, 'personal', 'tx2');
    expect(await service.getCount()).toBe(1);
  });

  it('short-circuits when a nullifier was already seen', async () => {
    const nullifier = '0x' + 'ee'.repeat(32);
    await service.record(nullifier, 'personal', 'tx1');
    // In-memory fast path returns true without any on-chain call.
    expect(await service.isUsed(nullifier)).toBe(true);
  });

  it('handles an unset registry id without throwing', async () => {
    const localConfig = new ConfigService({});
    const local = new NullifierService(localConfig, stellar, undefined);
    expect(await local.isUsed('0x' + '01'.repeat(32))).toBe(false);
  });
});
