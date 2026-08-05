import { POSEIDON_FIELD, POSEIDON_X5, PoseidonConfig } from './poseidon.constants';

/**
 * Circom-compatible Poseidon hash over the BN254 scalar field, matching
 * Noir 0.36 `std::hash::poseidon::bn254::hash_N` exactly:
 *
 *   - state = [0, inputs...] (length t)
 *   - x5 permutation (full rounds rf=8, partial rounds rp per width,
 *     alpha=5) using the Grain-derived round constants and MDS matrices
 *     from the Noir/poseidon2 suite
 *   - output = state[0]
 *
 * Vectors in `crypto.service.spec.ts` and the in-circuit
 * `poseidon::test_known_vectors` pin the same inputs/outputs so the
 * TypeScript stack and the Noir circuits cannot drift apart.
 */
export function poseidon(inputs: bigint[]): bigint {
  const config = POSEIDON_X5[inputs.length + 1];
  const state = [0n, ...inputs];
  const permuted = permute(config, state);
  return permuted[0];
}

function permute(config: PoseidonConfig, state: bigint[]): bigint[] {
  const { t, rf, rp, alpha } = config;
  const { rc, mds, presparse, sparse } = config;

  // Round constants for the first full round are folded into the initial
  // add, then consumed sequentially through the rest of the permutation.
  for (let i = 0; i < t; i++) state[i] = add(state[i], rc[i]);

  // First half of the full rounds.
  for (let r = 0; r < rf / 2 - 1; r++) {
    for (let i = 0; i < t; i++) state[i] = powSBox(state[i], alpha);
    for (let i = 0; i < t; i++) state[i] = add(state[i], rc[t * (r + 1) + i]);
    state = applyMatrix(mds, state, t);
  }

  // Middle full round feeding the partial rounds.
  for (let i = 0; i < t; i++) state[i] = powSBox(state[i], alpha);
  for (let i = 0; i < t; i++) state[i] = add(state[i], rc[t * (rf / 2) + i]);
  state = applyMatrix(presparse, state, t);

  // Partial rounds: S-box only on the first element, sparsified matrix.
  for (let r = 0; r < rp; r++) {
    state[0] = powSBox(state[0], alpha);
    state[0] = add(state[0], rc[(rf / 2 + 1) * t + r]);

    let new0 = 0n;
    for (let j = 0; j < t; j++) {
      new0 = add(new0, mul(sparse[(2 * t - 1) * r + j], state[j]));
    }
    for (let k = 1; k < t; k++) {
      state[k] = add(state[k], mul(state[0], sparse[(2 * t - 1) * r + t + k - 1]));
    }
    state[0] = new0;
  }

  // Second half of the full rounds.
  for (let r = 0; r < rf / 2 - 1; r++) {
    for (let i = 0; i < t; i++) state[i] = powSBox(state[i], alpha);
    for (let i = 0; i < t; i++) {
      state[i] = add(state[i], rc[(rf / 2 + 1) * t + rp + r * t + i]);
    }
    state = applyMatrix(mds, state, t);
  }

  for (let i = 0; i < t; i++) state[i] = powSBox(state[i], alpha);
  state = applyMatrix(mds, state, t);

  return state;
}

function applyMatrix(M: bigint[], state: bigint[], t: number): bigint[] {
  // Column-major storage: out[i] += state[j] * M[j*t + i]
  const out = new Array<bigint>(t).fill(0n);
  for (let i = 0; i < t; i++) {
    let acc = 0n;
    for (let j = 0; j < t; j++) {
      acc = add(acc, mul(state[j], M[j * t + i]));
    }
    out[i] = acc;
  }
  return out;
}

function powSBox(x: bigint, alpha: number): bigint {
  // x^5 = x * (x^2)^2
  const x2 = mul(x, x);
  const x4 = mul(x2, x2);
  return mul(x, x4);
}

function add(a: bigint, b: bigint): bigint {
  return (a + b) % POSEIDON_FIELD;
}

function mul(a: bigint, b: bigint): bigint {
  return (a * b) % POSEIDON_FIELD;
}
