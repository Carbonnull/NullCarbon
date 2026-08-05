# NullCarbon ZK Circuits

Zero-knowledge circuits for private, verifiable carbon credit retirement on Stellar.

> **Requires Noir 1.0.x** (`noirup` installs latest stable). Poseidon was moved out
> of the Noir standard library in 1.0; `utils` pulls it in as the external
> `noir-lang/poseidon` crate (git dep, tag `v0.3.0`), which is the same
> Circom-compatible implementation that `std::hash::poseidon::bn254::hash_N`
> provided in 0.x — hashes are byte-identical (verified by the pinned
> known-answer vectors in `utils/src/poseidon.nr`).

## Workspace Structure

```
circuits/
├── Nargo.toml              # Workspace manifest
├── utils/                  # Shared utility library
│   ├── Nargo.toml
│   └── src/
│       ├── lib.nr
│       ├── merkle.nr       # Merkle inclusion proofs
│       ├── poseidon.nr     # Nullifier & commitment hashing
│       └── range.nr        # Range check helpers
├── retirement_proof/       # Retirement circuit
│   ├── Nargo.toml
│   ├── Prover.toml         # Example proving inputs
│   └── src/main.nr
├── compliance_proof/       # Compliance (net-zero) circuit
│   ├── Nargo.toml
│   ├── Prover.toml
│   └── src/main.nr
└── vintage_proof/          # Vintage quality circuit
    ├── Nargo.toml
    ├── Prover.toml
    └── src/main.nr
```

## Circuits

### retirement_proof

Proves: "I hold a legitimate carbon credit from a verified registry, it has never been retired before, and I am now retiring it — without revealing which credit or who I am."

**Private inputs:**
- `credit_id: Field` — unique credit identifier
- `credit_secret: Field` — prover's binding secret (prevents nullifier linkage)
- `credit_hash: Field` — Poseidon leaf hash = `hash_4(credit_id, vintage_year, tonne_volume, methodology_code)`
- `vintage_year: u32` — year the carbon offset was generated
- `methodology_code: u32` — carbon standard methodology (REDD+ = 1, IFM = 2, etc.)
- `permanence_rating: u32` — permanence score (0–100)
- `tonne_volume: u64` — tonnes of CO2 retired
- `merkle_path: [Field; 20]` — sibling hashes for Merkle inclusion proof
- `merkle_indices: [bool; 20]` — left/right direction bits

**Public inputs:**
- `nullifier: Field` — unique retirement identifier (on-chain replay protection)
- `registry_merkle_root: Field` — current Merkle root of the registry
- `min_vintage_year: u32` — minimum acceptable vintage (per corridor)
- `min_permanence: u32` — minimum permanence rating
- `volume_commitment: Field` — Poseidon commitment to volume
- `corridor_id: Field` — retirement corridor (EU-CORSIA, Article 6, etc.)

**Constraints (6):**
1. Recompute leaf hash from components, verify against `credit_hash`, verify inclusion in registry Merkle tree
2. Vintage year >= minimum
3. Permanence rating >= minimum
4. Nullifier = `poseidon::hash_3(credit_secret, credit_id, corridor_id)`
5. Volume commitment = `poseidon::hash_2(tonne_volume, credit_secret)`
6. Tonne volume > 0

### compliance_proof

Proves: "My total retired volume across all credits this compliance period meets or exceeds my declared offset commitment."

**Private inputs:**
- `retirement_nullifiers: [Field; 50]` — nullifiers of retirements in this period
- `retirement_volumes: [u64; 50]` — corresponding volumes
- `active_count: u32` — number of active (non-padding) entries
- `company_secret: Field` — company's binding secret
- `nullifier_paths: [[Field; 20]; 50]` — Merkle paths for each nullifier
- `nullifier_indices: [[bool; 20]; 50]` — Merkle indices for each nullifier

**Public inputs:**
- `commitment_threshold: u64` — declared offset commitment in tonnes
- `period_id: Field` — compliance period identifier
- `compliance_nullifier: Field` — prevents double-submission
- `nullifier_set_root: Field` — Merkle root of all submitted retirement nullifiers

**Constraints (5):**
1. Sum active volumes; enforce padding entries are zero
2. Total volume >= commitment threshold
3. Compliance nullifier = `poseidon::hash_2(company_secret, period_id)`
4. Each active nullifier verified in nullifier Merkle tree
5. Active count <= 50

### vintage_proof

Proves: "This credit meets the quality requirements for a specific retirement corridor."

**Private inputs:**
- `vintage_year: u32`
- `methodology_code: u32`
- `co_benefits_score: u32` — social/biodiversity rating (0–100)
- `additionality_rating: u32` — was reduction additional? (0 = no, 1–5)
- `leakage_factor: u32` — risk of leakage (0–100, lower is better)
- `merkle_path: [Field; 20]` — methodology approval path
- `merkle_indices: [u1; 20]`

**Public inputs:**
- `standard_id: u32` — quality standard (1=CORSIA, 2=Article6, 3=EUTaxonomy)
- `min_vintage: u32`
- `min_co_benefits: u32`
- `max_leakage: u32`
- `approved_methodologies_root: Field` — Merkle root of approved methodology leaves

**Constraints (5):**
1. Vintage year >= minimum
2. Co-benefits score >= minimum
3. Leakage factor <= maximum
4. Additionality rating > 0
5. Methodology code included in approved methodologies Merkle tree (leaf = `poseidon::hash_2(methodology_code, standard_id)`)

## Verification Key Export

Verification keys are generated via `bb write_vk` (Barretenberg CLI):

```bash
cd circuits
bb write_vk -b ./target/retirement_proof.json -o ./target/retirement_vk
bb write_vk -b ./target/compliance_proof.json -o ./target/compliance_vk
bb write_vk -b ./target/vintage_proof.json -o ./target/vintage_vk
```

Requires Barretenberg installed on a machine with AVX512 support.

## Running Tests

```bash
cd circuits
nargo test --workspace
```

All 23 tests pass across utils (14), retirement_proof (3), compliance_proof (3), and vintage_proof (3).

## Proving

`nargo prove` was removed from Nargo in 1.0 — `nargo` only compiles and executes. Real proofs are generated client-side with `@noir-lang/noir_js` + `@aztec/bb.js` (see `frontend/src/app/shared/services/noir.service.ts`), then verified on-chain by the Soroban `RetirementVerifier` contract. Each circuit's `Prover.toml` holds example witness inputs for `nargo check` / execution, with the placeholder hashes replaced by real Poseidon values computed off-chain.
