// Sparse Merkle tree inclusion proofs using Circom-compatible Poseidon
// (`poseidon::poseidon::bn254::hash_N`).
//
// The off-chain stack reproduces every hash here exactly:
//   - node hash:       Poseidon2(sibling, computed) -> hash_2
//   - credit leaf:     Poseidon4(credit_id, vintage, volume, methodology) -> hash_4
//   - methodology leaf: Poseidon2(methodology_code, standard_id) -> hash_2
//
// Tree padding contract: an empty subtree at height h has root
// zero_hash(h) = hash_2(zero_hash(h-1), zero_hash(h-1)) with
// zero_hash(0) = hash_4([0, 0, 0, 0]). The backend must use the same
// constants when building the tree so proofs verify.

use poseidon::poseidon::bn254::hash_2;
use poseidon::poseidon::bn254::hash_4;

pub fn verify_merkle_inclusion(leaf: Field, path: [Field; 20], indices: [bool; 20]) -> Field {
    let mut computed = leaf;
    for i in 0..20 {
        let sibling = path[i];
        if indices[i] == false {
            computed = hash_2([computed, sibling]);
        } else {
            computed = hash_2([sibling, computed]);
        }
    }
    computed
}

pub fn compute_leaf_hash(credit_id: Field, vintage: u32, volume: u64, methodology: u32) -> Field {
    hash_4([credit_id, vintage as Field, volume as Field, methodology as Field])
}

pub fn compute_methodology_leaf(methodology_code: Field, standard_id: Field) -> Field {
    hash_2([methodology_code, standard_id])
}

/// Root of an empty subtree of the given height (see module contract).
pub fn compute_zero_hash(level: u32) -> Field {
    let mut zero = hash_4([0, 0, 0, 0]);
    for _ in 0..level {
        zero = hash_2([zero, zero]);
    }
    zero
}

#[test]
fn test_methodology_leaf_consistency() {
    let l1 = compute_methodology_leaf(1, 1);
    let l2 = compute_methodology_leaf(1, 1);
    assert(l1 == l2);
}

#[test]
fn test_methodology_leaf_different() {
    let l1 = compute_methodology_leaf(1, 1);
    let l2 = compute_methodology_leaf(2, 1);
    assert(l1 != l2);
}

#[test]
fn test_merkle_inclusion_identity_path() {
    let leaf: Field = 0;
    let path: [Field; 20] = [0; 20];
    let indices: [bool; 20] = [false; 20];
    let computed_root = verify_merkle_inclusion(leaf, path, indices);
    assert(computed_root != leaf);
}

#[test]
fn test_leaf_hash_consistency() {
    let h1 = compute_leaf_hash(1, 2022, 3000, 1);
    let h2 = compute_leaf_hash(1, 2022, 3000, 1);
    assert(h1 == h2);
}

#[test]
fn test_leaf_hash_different() {
    let h1 = compute_leaf_hash(1, 2022, 3000, 1);
    let h2 = compute_leaf_hash(2, 2023, 5000, 2);
    assert(h1 != h2);
}

#[test]
fn test_zero_hash_levels() {
    let z0 = compute_zero_hash(0);
    assert(z0 == hash_4([0, 0, 0, 0]));
    let z1 = compute_zero_hash(1);
    assert(z1 == hash_2([z0, z0]));
    let z2 = compute_zero_hash(2);
    assert(z2 == hash_2([z1, z1]));
}
