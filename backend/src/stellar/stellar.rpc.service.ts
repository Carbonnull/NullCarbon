import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { xdr } from '@stellar/stellar-sdk';

/**
 * Read-only Soroban RPC access. Used to query the on-chain source of truth
 * (RetirementVerifier::get_retirement, NullifierRegistry::is_used) without
 * building or submitting transactions.
 */
@Injectable()
export class StellarRpcService {
  private readonly rpcUrl: string;
  private readonly passphrase: string;
  // Public Stellar testnet address with no funds; only used as a dummy
  // source for simulated read-only invocations.
  private static readonly SOURCE =
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

  constructor(private readonly config: ConfigService) {
    this.rpcUrl =
      config.get('STELLAR_RPC_URL') || 'https://soroban-testnet.stellar.org';
    this.passphrase =
      config.get('STELLAR_PASSPHRASE') || 'Test SDF Network ; September 2015';
  }

  /**
   * Simulate a read-only contract invocation and return the decoded return
   * value, or `undefined` when the call fails or the contract errors.
   */
  async readContract(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<unknown> {
    if (!contractId) return undefined;

    const sdk = await import('@stellar/stellar-sdk');
    const server = new sdk.rpc.Server(this.rpcUrl);
    const contract = new sdk.Contract(contractId);
    const source = new sdk.Account(StellarRpcService.SOURCE, '0');

    const tx = new sdk.TransactionBuilder(source, {
      fee: '1000000',
      networkPassphrase: this.passphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    if (sdk.rpc.Api.isSimulationError(result)) {
      throw new Error(`Simulation failed for ${method}: ${result.error}`);
    }
    if (!result.result?.retval) {
      return undefined;
    }
    return sdk.scValToNative(result.result.retval);
  }

  /** Convert a hex-encoded 32-byte field to an xdr scvBytes argument. */
  static bytes32Arg(hex: string): xdr.ScVal {
    const raw = Buffer.from(hex.replace(/^0x/, ''), 'hex');
    if (raw.length !== 32) {
      throw new Error(`Expected 32 bytes for contract argument, got ${raw.length}`);
    }
    return xdr.ScVal.scvBytes(raw);
  }
}
