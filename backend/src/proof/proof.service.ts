import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { NullifierService } from '../nullifier/nullifier.service';
import { CertificateService } from '../certificate/certificate.service';

export interface RetirementPublicInputs {
  nullifier: string;
  registryMerkleRoot: string;
  volumeCommitment: string;
  corridorId: string;
  minVintageYear: number;
  minPermanence: number;
}

export interface ProofRelayResult {
  verified: boolean;
  txHash?: string;
  nullifier?: string;
  certificateId?: string;
  error?: string;
}

export interface CompliancePublicInputs {
  commitmentThreshold: number;
  periodId: string;
  complianceNullifier: string;
  nullifierSetRoot: string;
}

export interface ComplianceRelayResult {
  compliant: boolean;
  txHash?: string;
  complianceCertificateId?: string;
  error?: string;
}

@Injectable()
export class ProofService {
  private readonly rpcUrl: string;
  private readonly retirementVerifierId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly nullifierService: NullifierService,
    private readonly certificateService: CertificateService,
    @Optional() @Inject('PG_POOL') private readonly db?: Pool,
  ) {
    this.rpcUrl =
      config.get('STELLAR_RPC_URL') || 'https://soroban-testnet.stellar.org';
    this.retirementVerifierId = config.get('RETIREMENT_VERIFIER_ID') || '';
  }

  async relayRetirementProof(
    proof: string,
    publicInputs: RetirementPublicInputs,
  ): Promise<ProofRelayResult> {
    // Guard: reject already-used nullifiers fast
    if (await this.nullifierService.isUsed(publicInputs.nullifier)) {
      return { verified: false, error: 'Nullifier already used' };
    }

    try {
      // Build and submit the Soroban transaction
      const { txHash, ledger } = await this.submitToSoroban(proof, publicInputs);

      // Record the nullifier
      await this.nullifierService.record(
        publicInputs.nullifier,
        publicInputs.corridorId,
        txHash,
      );

      // Issue certificate
      const certificate = await this.certificateService.addCertificate({
        nullifier: publicInputs.nullifier,
        registryRoot: publicInputs.registryMerkleRoot,
        volumeCommitment: publicInputs.volumeCommitment,
        corridorId: publicInputs.corridorId,
        stellarTxHash: txHash,
        ledger,
        verifiable: true,
        timestamp: new Date().toISOString(),
      });

      return {
        verified: true,
        txHash,
        nullifier: publicInputs.nullifier,
        certificateId: certificate.certificateId,
      };
    } catch (err: any) {
      return { verified: false, error: err?.message || 'Relay failed' };
    }
  }

  async relayComplianceProof(
    proof: string,
    publicInputs: CompliancePublicInputs,
  ): Promise<ComplianceRelayResult> {
    if (await this.nullifierService.isUsed(publicInputs.complianceNullifier)) {
      return { compliant: false, error: 'Compliance nullifier already used' };
    }

    try {
      const { txHash } = await this.submitComplianceToSoroban(proof, publicInputs);

      const corridorId = `compliance:${publicInputs.periodId}`;
      await this.nullifierService.record(
        publicInputs.complianceNullifier,
        corridorId,
        txHash,
      );

      // Persist the compliance claim as an auditable certificate so that
      // GET /compliance/status/:companyId can return a verifiable result.
      const certificate = await this.certificateService.addCertificate(
        {
          nullifier: publicInputs.complianceNullifier,
          corridorId,
          volumeCommitment: publicInputs.nullifierSetRoot,
          stellarTxHash: txHash,
          verifiable: true,
          timestamp: new Date().toISOString(),
        },
        'COMP',
      );

      return {
        compliant: true,
        txHash,
        complianceCertificateId: certificate.certificateId,
      };
    } catch (err: any) {
      return { compliant: false, error: err?.message || 'Compliance relay failed' };
    }
  }

  /**
   * Submit a retirement proof to the Soroban RetirementVerifier contract.
   * Uses @stellar/stellar-sdk to build and submit the transaction.
   */
  private async submitToSoroban(
    proof: string,
    inputs: RetirementPublicInputs,
  ): Promise<{ txHash: string; ledger: number }> {
    if (!this.retirementVerifierId) {
      // Dev mode: simulate a successful submission
      return { txHash: `devtx_${Date.now()}`, ledger: 0 };
    }

    const sdk = await import('@stellar/stellar-sdk');
    const server = new sdk.rpc.Server(this.rpcUrl);
    const keypair = sdk.Keypair.fromSecret(
      this.config.get('DEPLOYER_SECRET_KEY') || '',
    );

    const account = await server.getAccount(keypair.publicKey());
    const contract = new sdk.Contract(this.retirementVerifierId);

    // Build public_inputs bytes (136 bytes)
    const publicInputsBytes = this.encodePublicInputs(inputs);

    const tx = new sdk.TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase:
        this.config.get('STELLAR_PASSPHRASE') ||
        'Test SDF Network ; September 2015',
    })
      .addOperation(
        contract.call(
          'verify_retirement',
          sdk.xdr.ScVal.scvBytes(Buffer.from(proof.replace('0x', ''), 'hex')),
          sdk.xdr.ScVal.scvBytes(publicInputsBytes),
          sdk.xdr.ScVal.scvU64(sdk.xdr.Uint64.fromString('1')),
          sdk.xdr.ScVal.scvAddress(
            sdk.Address.fromString(keypair.publicKey()).toScAddress(),
          ),
        ),
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(keypair);

    const result = await server.sendTransaction(prepared);
    if (result.status === 'ERROR') {
      throw new Error(`Transaction failed: ${result.errorResult?.toXDR('base64')}`);
    }

    // Poll for completion
    let pollResult = await server.getTransaction(result.hash);
    let attempts = 0;
    while (
      pollResult.status === sdk.rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 20
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      pollResult = await server.getTransaction(result.hash);
      attempts++;
    }

    if (pollResult.status !== sdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`Transaction did not succeed: ${pollResult.status}`);
    }

    return {
      txHash: result.hash,
      ledger: pollResult.ledger ?? 0,
    };
  }

  private async submitComplianceToSoroban(
    _proof: string,
    _inputs: CompliancePublicInputs,
  ): Promise<{ txHash: string }> {
    // Compliance circuit on-chain relay follows the same pattern as retirement.
    // Stubbed for now — same implementation as submitToSoroban with different method name.
    return { txHash: `comptx_${Date.now()}` };
  }

  /** Encode RetirementPublicInputs into 136 bytes matching the contract's expected layout. */
  private encodePublicInputs(inputs: RetirementPublicInputs): Buffer {
    const buf = Buffer.alloc(136);
    const toBytes32 = (hex: string) =>
      Buffer.from(hex.replace('0x', '').padStart(64, '0'), 'hex');

    toBytes32(inputs.nullifier).copy(buf, 0);
    toBytes32(inputs.registryMerkleRoot).copy(buf, 32);
    toBytes32(inputs.volumeCommitment).copy(buf, 64);
    toBytes32(inputs.corridorId).copy(buf, 96);
    buf.writeUInt32BE(inputs.minVintageYear, 128);
    buf.writeUInt32BE(inputs.minPermanence, 132);
    return buf;
  }
}
