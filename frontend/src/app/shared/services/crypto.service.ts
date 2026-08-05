import { Injectable } from '@angular/core';
import { poseidon } from '../crypto/poseidon';
import { POSEIDON_FIELD } from '../crypto/poseidon.constants';

export const TREE_DEPTH = 20;

function toHex(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0');
}

function fromHex(h: string): bigint {
  return BigInt(h.startsWith('0x') ? h : '0x' + h);
}

/** Encode an ASCII credit id as a BN254 field element (big-endian, <= 31 bytes). */
export function creditIdToField(creditId: string): bigint {
  const clean = creditId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 31);
  let hex = '';
  for (let i = 0; i < clean.length; i++) {
    hex += clean.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return BigInt('0x' + hex.padStart(62, '0'));
}

/**
 * Single Poseidon implementation shared by every NullCarbon component.
 * Mirrors the Noir circuits (`std::hash::poseidon::bn254::hash_N`) and the
 * backend `CryptoService` exactly.
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  /** Poseidon_1(input) — not used on-chain; provided for completeness. */
  hash1(input: bigint): bigint {
    return poseidon([input]);
  }

  /** Poseidon_2(left, right) — Merkle node hash, compliance nullifier, volume commitment. */
  hash2(left: bigint, right: bigint): bigint {
    return poseidon([left, right]);
  }

  /** Poseidon_3(credit_secret, credit_id, corridor_id) — retirement nullifier. */
  hash3(a: bigint, b: bigint, c: bigint): bigint {
    return poseidon([a, b, c]);
  }

  /** Poseidon_4(credit_id, vintage, volume, methodology) — credit leaf hash. */
  hash4(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
    return poseidon([a, b, c, d]);
  }

  /** Merkle node hash: hash2(left, right). */
  merkleHash(left: string, right: string): string {
    return toHex(this.hash2(fromHex(left), fromHex(right)));
  }

  /** Credit leaf hash matching `merkle::compute_leaf_hash`. */
  computeCreditLeafHash(credit: {
    creditId: string;
    vintage: number;
    volume: number;
    methodologyCode: number;
  }): string {
    return toHex(
      this.hash4(
        creditIdToField(credit.creditId),
        BigInt(credit.vintage),
        BigInt(credit.volume),
        BigInt(credit.methodologyCode),
      ),
    );
  }

  /** Retirement nullifier matching `poseidon::compute_retirement_nullifier`. */
  computeRetirementNullifier(
    creditSecret: bigint,
    creditId: bigint,
    corridorId: bigint,
  ): string {
    return toHex(this.hash3(creditSecret, creditId, corridorId));
  }

  /** Compliance nullifier matching `poseidon::compute_compliance_nullifier`. */
  computeComplianceNullifier(companySecret: bigint, periodId: bigint): string {
    return toHex(this.hash2(companySecret, periodId));
  }

  /** Volume commitment matching `poseidon::compute_volume_commitment`. */
  computeVolumeCommitment(tonneVolume: bigint, creditSecret: bigint): string {
    return toHex(this.hash2(tonneVolume, creditSecret));
  }

  /**
   * Root of a fully-empty subtree of `level` height. Matches the circuit's
   * `merkle::compute_zero_hash`: zero leaf = hash4([0,0,0,0]), folded up
   * with hash2.
   */
  zeroHashAt(level: number): string {
    let zero = toHex(this.hash4(0n, 0n, 0n, 0n));
    for (let i = 0; i < level; i++) {
      zero = this.merkleHash(zero, zero);
    }
    return zero;
  }

  get fieldOrder(): bigint {
    return POSEIDON_FIELD;
  }

  /**
   * Deterministically encode an arbitrary ASCII label (e.g. a compliance
   * period id like "2025-Q1") as a BN254 field element, big-endian.
   */
  fieldFromLabel(label: string): bigint {
    return creditIdToField(label);
  }

  /**
   * Parse a field element from a string. Accepts `0x`-prefixed hex, plain
   * decimal, or plain hex (all-hex characters without a prefix).
   */
  toField(input: string): bigint {
    if (input.startsWith('0x')) return BigInt(input);
    if (/^[0-9]+$/.test(input)) return BigInt(input);
    return BigInt('0x' + input);
  }
}
