// Poseidon hashing primitives shared across NullCarbon circuits.
//
// These deliberately use `std::hash::poseidon::bn254::hash_N`, the
// Circom-compatible Poseidon construction (state = [0, inputs...], x5
// permutation, output state[0]). The backend and frontend implement the
// exact same construction, so hashes computed off-chain (Merkle roots,
// nullifiers, volume commitments) match what these circuits prove on-chain.

/// nullifier = Poseidon(credit_secret, credit_id, corridor_id)
pub fn compute_retirement_nullifier(credit_secret: Field, credit_id: Field, corridor_id: Field) -> Field {
    std::hash::poseidon::bn254::hash_3([credit_secret, credit_id, corridor_id])
}

/// compliance nullifier = Poseidon(company_secret, period_id)
pub fn compute_compliance_nullifier(company_secret: Field, period_id: Field) -> Field {
    std::hash::poseidon::bn254::hash_2([company_secret, period_id])
}

/// volume commitment = Poseidon(tonne_volume, credit_secret)
pub fn compute_volume_commitment(tonne_volume: u64, credit_secret: Field) -> Field {
    std::hash::poseidon::bn254::hash_2([tonne_volume as Field, credit_secret])
}

#[test]
fn test_retirement_nullifier_consistency() {
    let n1 = compute_retirement_nullifier(1, 2, 3);
    let n2 = compute_retirement_nullifier(1, 2, 3);
    assert(n1 == n2);
}

#[test]
fn test_compliance_nullifier_consistency() {
    let n1 = compute_compliance_nullifier(42, 2025);
    let n2 = compute_compliance_nullifier(42, 2025);
    assert(n1 == n2);
}

#[test]
fn test_volume_commitment_consistency() {
    let c1 = compute_volume_commitment(3000, 99);
    let c2 = compute_volume_commitment(3000, 99);
    assert(c1 == c2);
}

/// Cross-layer contract vectors: these exact inputs/outputs are asserted in
/// the backend and frontend Poseidon implementations so any drift between the
/// circuit and the TypeScript stack fails CI on both sides.
#[test]
fn test_known_vectors() {
    assert(std::hash::poseidon::bn254::hash_2([42, 3000]) == 0x153f23bd8c5d008b2ace376340675143a23e2ab8061dc9f35109cb39ee9062f5);
    assert(std::hash::poseidon::bn254::hash_3([1, 2, 3]) == 0xe7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732);
    assert(std::hash::poseidon::bn254::hash_4([5, 2022, 3000, 1]) == 0x14dea2614a59680fd23fe51094167d22c469c17f7cf123384e120c8895424c09);
    assert(std::hash::poseidon::bn254::hash_4([0, 0, 0, 0]) == 0x532fd436e19c70e51209694d9c215250937921b8b79060488c1206db73e9946);
}
