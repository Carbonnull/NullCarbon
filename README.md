# NullCarbon

> **Private, Verifiable Carbon Credit Retirement on Stellar**
> Zero-knowledge proofs for tamper-proof carbon offsetting — nullifier-backed retirement, greenwashing-resistant compliance, and portfolio-private net-zero claims, all verified on-chain via Soroban.

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [ZK Circuit Design](#zk-circuit-design)
- [Soroban Smart Contracts](#soroban-smart-contracts)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Frontend Flow](#frontend-flow)
- [Demo Walkthrough](#demo-walkthrough)
- [Stellar Protocol 25 & 26 Integration](#stellar-protocol-25--26-integration)
- [Carbon Registry Integration](#carbon-registry-integration)
- [Security Considerations](#security-considerations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

---

## The Problem

The voluntary carbon market moves over **$2 billion per year** — and most of it cannot be trusted.

### The Credibility Crisis

Carbon credits are supposed to represent real, verified, permanent removal or avoidance of CO₂. In practice, the market is riddled with structural failures:

**Double Counting**
The same credit can be issued, sold, and "retired" by multiple parties across different registries. There is no universal, tamper-proof ledger. A credit retired by a corporation in one registry may still appear as available in another.

**Ghost Credits**
Studies — including a 2023 Guardian/Zeit investigation — found that over 90% of Verra's rainforest offset credits did not represent genuine carbon reductions. Credits were issued for forests that were never under threat.

**Unverifiable Retirement**
When a company says they are "carbon neutral," there is no cryptographic proof. Retirement claims live in siloed registry databases that are opaque, slow to update, and impossible for the public to audit in real time.

**Greenwashing at Scale**
Corporations spend millions on offsets and make net-zero pledges with no auditable, on-chain basis. Regulators, investors, and the public have no way to independently verify these claims without trusting the company's own reporting.

**Privacy vs Transparency Deadlock**
Putting carbon trading fully on a public blockchain solves transparency but destroys privacy — competitors can see a company's entire offset strategy, supplier relationships, and carbon liability exposure. This stops institutional adoption cold.

**Registry Fragmentation**
Verra (VCS), Gold Standard, ACX, American Carbon Registry, and others operate independently. A credit from one registry is opaque to another. Cross-registry verification is manual, slow, and error-prone.

### What the Market Needs

A system where:
- Every retirement is **cryptographically unique** — mathematically impossible to double-count
- Net-zero claims are **verifiable on-chain** without exposing portfolio details
- Institutional buyers get **privacy** — prove sufficiency without revealing strategy
- Anyone can **audit** the integrity of the retirement record in real time
- The system works **across registries** without requiring them to merge or share data

---

## The Solution

**NullCarbon** is a zero-knowledge carbon credit retirement and compliance layer built on Stellar. It uses Noir ZK circuits and Soroban smart contracts to make carbon offsetting cryptographically provable, privately verifiable, and permanently tamper-proof.

### The Core Insight

Every carbon credit retirement in NullCarbon produces a **nullifier** — a unique cryptographic value derived from the credit itself. Once a nullifier is recorded on-chain, it is mathematically impossible to retire the same credit again, on any platform, ever. This is borrowed directly from ZK privacy protocol design (Zcash, Tornado Cash, Aztec) and applied to the carbon market for the first time on Stellar.

### What NullCarbon Delivers

**For corporations:**
- Retire carbon credits privately — prove net-zero compliance to regulators without exposing your carbon portfolio to competitors
- Generate a verifiable, on-chain proof of offset that auditors and investors can check independently

**For regulators and auditors:**
- Access tamper-proof, on-chain retirement records anchored to real registry data
- Verify net-zero claims cryptographically without needing to trust the company's own reporting

**For the market:**
- A universal double-spend prevention layer that works across registries
- A credibility primitive that makes greenwashing cryptographically hard

---

## How It Works

```
┌──────────────────────────────────────────────────────────────────┐
│                        CORPORATE USER                            │
│                                                                  │
│  1. Connect Freighter wallet                                     │
│  2. Import carbon credit from registry (Verra, Gold Standard)   │
│     → Credit is tokenized as a Stellar asset                    │
│  3. Initiate retirement: select credit(s) + offset claim amount │
│  4. Generate ZK proof locally in browser (Noir WASM):           │
│     - Prove: credit was issued by a verified registry           │
│     - Prove: credit has not been previously retired (nullifier) │
│     - Prove: total retired volume ≥ declared offset commitment  │
│     - Prove: credit vintage meets buyer/regulatory requirements │
│     - Reveal: nullifier (on-chain, prevents replay)             │
│     - Reveal: offset amount range (e.g. "≥ 1000 tonnes")       │
│     - Hide: exact portfolio, supplier, credit IDs               │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                   SOROBAN SMART CONTRACTS                        │
│                                                                  │
│  5. NullifierRegistry contract:                                  │
│     - Check nullifier has never been recorded                   │
│     - Record nullifier permanently on-chain                     │
│  6. RetirementVerifier contract:                                 │
│     - Receive proof + public inputs                             │
│     - Call BN254 host functions (Protocol 25/26):               │
│       bn254_pairing_check, bn254_msm, poseidon2_hash            │
│     - Verify Noir UltraHonk proof on-chain                      │
│     - If valid → emit RetirementCertificate event               │
│  7. CreditRegistry contract:                                     │
│     - Mark tokenized credit as retired                          │
│     - Burn the Stellar asset token                              │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STELLAR NETWORK                               │
│                                                                  │
│  8. On-chain retirement certificate minted as a Stellar asset   │
│  9. Nullifier permanently anchored to the ledger                │
│  10. Public audit record: registry, vintage, volume range       │
│      Private: buyer identity, exact amount, credit IDs          │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                  COMPLIANCE PORTAL                               │
│                                                                  │
│  11. Company shares a proof link with regulators/auditors       │
│  12. Anyone can verify the proof on-chain independently         │
│  13. Retirement certificate is publicly auditable               │
│      Identity and portfolio remain private                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 🔒 Nullifier-Backed Retirement
Every retirement generates a Poseidon nullifier anchored on Stellar. Once recorded, the same credit cannot be retired again — on any chain, in any registry, by any party. This is the first cryptographic solution to double-counting in the voluntary carbon market.

### 🕵️ Private Net-Zero Claims
Corporations prove compliance using ZK range proofs: "we have retired ≥ N tonnes this year" without revealing which credits, from which registries, or the exact amount. Competitors learn nothing. Regulators get everything they need.

### 📜 Verifiable Retirement Certificates
Each successful retirement mints a **RetirementCertificate** — a Stellar asset that serves as a publicly auditable, cryptographically signed receipt. Anyone can verify its authenticity on-chain without trusting the issuer.

### 🌐 Cross-Registry Merkle Proofs
NullCarbon uses off-chain Merkle trees of credit hashes from major registries (Verra, Gold Standard, ACX). ZK proofs of inclusion prove a credit is legitimate without requiring the registries to go on-chain or share data with each other.

### ⚡ On-Chain Verification via BN254 Host Functions
Proof verification runs entirely on Soroban using Stellar Protocol 25/26 BN254 host functions — making full UltraHonk proof verification affordable and fast on-chain. No off-chain verification oracle needed.

### 🌍 Vintage & Methodology Compliance
The circuit enforces credit quality rules: vintage year requirements, approved methodologies, minimum permanence ratings — all without revealing the specific credit attributes.

---

## Architecture

```
nullcarbon/
├── circuits/          # Noir ZK circuits
├── contracts/         # Soroban smart contracts (Rust)
├── backend/           # NestJS API (registry bridge, credential issuance)
├── frontend/          # Angular web app (retirement flow, compliance portal)
├── indexer/           # Event indexer for retirement certificates
└── scripts/           # Deployment, testing, registry sync
```

### Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Angular)                      │
│  WalletConnect │ CreditImport │ RetirementFlow │ AuditPortal   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                        BACKEND (NestJS)                         │
│  RegistryBridge │ MerkleService │ ProofRelay │ CertificateIndex │
└──────┬──────────────────────────────────────────┬───────────────┘
       │ Stellar SDK                              │ Noir WASM
┌──────▼──────────┐                    ┌──────────▼──────────────┐
│ SOROBAN         │                    │ NOIR CIRCUITS           │
│ RetirementVerif │◄───── proof ───────│ retirement_proof.nr     │
│ NullifierReg    │                    │ compliance_proof.nr     │
│ CreditRegistry  │                    │ vintage_proof.nr        │
└─────────────────┘                    └─────────────────────────┘
       │
┌──────▼──────────┐
│ STELLAR NETWORK │
│ Testnet/Mainnet │
└─────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| **Noir Circuits** | Define what must be proven: credit validity, nullifier uniqueness, offset sufficiency, vintage compliance |
| **Barretenberg WASM** | Runs in the browser; generates UltraHonk proofs from the user's private credit data |
| **RetirementVerifier (Soroban)** | Verifies Noir proofs on-chain using BN254 host functions |
| **NullifierRegistry (Soroban)** | Stores all used nullifiers; prevents double-retirement forever |
| **CreditRegistry (Soroban)** | Tracks tokenized credit issuance, ownership, and burn-on-retirement |
| **NestJS Backend** | Registry bridge, Merkle tree generation, proof relay, certificate indexing |
| **Angular Frontend** | End-to-end user flow: import → retire → prove → certify → audit |
| **Indexer** | Listens to Soroban events; builds the public retirement audit feed |

---

## Tech Stack

| Layer | Technology |
|---|---|
| ZK Proof System | [Noir](https://noir-lang.org/) + Barretenberg (UltraHonk) |
| Proof Generation | `@noir-lang/noir_js` + `@aztec/bb.js` (WASM, browser) |
| Smart Contracts | Rust on [Soroban](https://soroban.stellar.org/) |
| On-chain Crypto | Stellar Protocol 25/26 BN254 + Poseidon host functions |
| Blockchain | [Stellar](https://stellar.org/) Testnet → Mainnet |
| Backend | [NestJS](https://nestjs.com/) (TypeScript) |
| Frontend | [Angular](https://angular.io/) 17+ (standalone components) |
| Wallet | [Freighter](https://www.freighter.app/) |
| Stellar SDK | `@stellar/stellar-sdk` |
| Database | PostgreSQL (nullifier index, certificate cache) |
| Registry Data | Verra API, Gold Standard API (Merkle tree source) |

---

## Project Structure

```
nullcarbon/
│
├── circuits/
│   ├── src/
│   │   ├── retirement_proof.nr        # Main retirement circuit
│   │   ├── compliance_proof.nr        # Net-zero compliance range proof
│   │   ├── vintage_proof.nr           # Credit vintage & methodology checks
│   │   └── utils/
│   │       ├── merkle.nr              # Merkle inclusion proof helpers
│   │       ├── poseidon.nr            # Nullifier computation
│   │       └── range.nr               # Range proof helpers
│   ├── Nargo.toml
│   └── Prover.toml                    # Example inputs for testing
│
├── contracts/
│   ├── retirement_verifier/
│   │   ├── src/lib.rs                 # UltraHonk proof verifier
│   │   └── Cargo.toml
│   ├── nullifier_registry/
│   │   ├── src/lib.rs                 # Nullifier storage & replay protection
│   │   └── Cargo.toml
│   ├── credit_registry/
│   │   ├── src/lib.rs                 # Tokenized credit lifecycle
│   │   └── Cargo.toml
│   └── scripts/
│       ├── deploy.sh
│       └── invoke.sh
│
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── crypto/
│   │   │   ├── crypto.module.ts
│   │   │   ├── crypto.service.ts      # Poseidon hash_N wrapper (shared with circuits)
│   │   │   ├── poseidon.ts            # Circom-compatible x5 Poseidon permutation
│   │   │   └── poseidon.constants.ts  # Generated round constants / MDS matrices
│   │   ├── registry/
│   │   │   ├── registry.module.ts
│   │   │   ├── registry.service.ts    # Verra/GS API bridge + PostgreSQL sync
│   │   │   └── registry.controller.ts
│   │   ├── merkle/
│   │   │   ├── merkle.module.ts
│   │   │   └── merkle.service.ts      # 20-deep Poseidon Merkle trees + proofs
│   │   ├── proof/
│   │   │   ├── proof.module.ts
│   │   │   └── proof.service.ts       # Proof relay to Soroban
│   │   ├── certificate/
│   │   │   ├── certificate.module.ts
│   │   │   └── certificate.service.ts # Retirement certificate indexer
│   │   ├── nullifier/
│   │   │   ├── nullifier.module.ts
│   │   │   └── nullifier.service.ts   # Nullifier tracking & lookup
│   │   ├── stellar/
│   │   │   ├── stellar.module.ts
│   │   │   └── stellar.rpc.service.ts # Soroban read client (get_retirement, is_used)
│   │   └── compliance/
│   │       ├── compliance.module.ts
│   │       └── compliance.service.ts  # Net-zero claim generation + set roots
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts
│   │   │   ├── app.routes.ts
│   │   │   ├── features/
│   │   │   │   ├── wallet/
│   │   │   │   │   └── wallet-connect.component.ts
│   │   │   │   ├── credits/
│   │   │   │   │   └── credit-portfolio.component.ts
│   │   │   │   ├── retirement/
│   │   │   │   │   ├── retirement-flow.component.ts
│   │   │   │   │   └── proof-generate.component.ts
│   │   │   │   ├── compliance/
│   │   │   │   │   └── net-zero-claim.component.ts
│   │   │   │   └── audit/
│   │   │   │       ├── audit-portal.component.ts
│   │   │   │       └── certificate-verify.component.ts
│   │   │   └── shared/
│   │   │       ├── crypto/
│   │   │       │   ├── poseidon.ts            # Same Poseidon as backend/circuits
│   │   │       │   └── poseidon.constants.ts
│   │   │       └── services/
│   │   │           ├── crypto.service.ts      # hash_N / nullifiers / commitments
│   │   │           ├── noir.service.ts
│   │   │           ├── stellar.service.ts
│   │   │           ├── registry.service.ts
│   │   │           └── certificate.service.ts
│   │   └── environments/
│   ├── angular.json
│   └── package.json
│
├── indexer/
│   ├── src/
│   │   ├── index.ts                   # Soroban event listener (2 pipelines)
│   │   ├── handlers/
│   │   │   ├── stellar.events.ts      # Topic decoding + event normalization
│   │   │   ├── stellar.event-source.ts# Cursor-based source with exact topic filter
│   │   │   ├── retirement.handler.ts
│   │   │   └── nullifier.handler.ts
│   │   └── db/
│   │       ├── database.ts            # State, dedupe + schema bootstrap
│   │       └── schema.ts
│   └── package.json
│
├── scripts/
│   ├── setup.sh
│   ├── sync-registry.sh               # Pull credits from Verra/GS APIs
│   ├── build-merkle.sh                # Rebuild Merkle tree from registry data
│   ├── test-e2e.sh
│   └── fund-testnet.sh
│
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## ZK Circuit Design

NullCarbon uses three composable Noir circuits that together cover the full retirement and compliance lifecycle.

### Circuit 1: `retirement_proof.nr` — The Core Retirement Proof

Proves in zero knowledge:
> *"I hold a legitimate carbon credit from a verified registry, it has never been retired before, and I am now retiring it — without revealing which credit, from which registry, or who I am."*

```noir
// circuits/retirement_proof/src/main.nr

use utils::merkle;
use utils::poseidon;
use utils::range;

fn main(
    // ── Private Inputs (never revealed) ──────────────────────────────
    credit_id: Field,               // Registry-assigned credit identifier
    credit_secret: Field,           // Holder's secret binding key
    credit_hash: Field,             // Poseidon hash of full credit metadata
    vintage_year: u32,              // Year the credit was issued
    methodology_code: u32,          // Carbon methodology (REDD+, IFM, DAC, etc.)
    permanence_rating: u32,         // Credit permanence score (0–100)
    tonne_volume: u64,              // Volume being retired in this tx
    merkle_path: [Field; 20],       // Merkle proof path (20-deep registry tree)
    merkle_indices: [bool; 20],     // Left/right indicators for Merkle path

    // ── Public Inputs (revealed on-chain) ────────────────────────────
    nullifier: Field,           // Unique retirement fingerprint (prevents replay)
    registry_merkle_root: Field,// Current Merkle root of verified credits
    min_vintage_year: u32,      // Minimum acceptable vintage (public policy)
    min_permanence: u32,        // Minimum permanence rating required
    volume_commitment: Field,   // Poseidon commitment to tonne_volume
    corridor_id: Field,         // Retirement corridor (buyer jurisdiction)
) {
    // 1. Verify credit exists in the registry Merkle tree
    let computed_leaf = merkle::compute_leaf_hash(credit_id, vintage_year, tonne_volume, methodology_code);
    assert(computed_leaf == credit_hash, "Credit leaf hash mismatch");

    let computed_root = merkle::verify_merkle_inclusion(credit_hash, merkle_path, merkle_indices);
    assert(computed_root == registry_merkle_root, "Credit not found in verified registry");

    // 2. Verify vintage year meets minimum requirement
    range::assert_gte_u32(vintage_year, min_vintage_year, "Credit vintage too old");

    // 3. Verify permanence rating meets threshold
    range::assert_gte_u32(permanence_rating, min_permanence, "Credit permanence rating insufficient");

    // 4. Compute and verify nullifier
    //    nullifier = Poseidon_3(credit_secret, credit_id, corridor_id)
    //    Binding to corridor_id ensures credit can't be replayed in a different context
    let computed_nullifier = poseidon::compute_retirement_nullifier(credit_secret, credit_id, corridor_id);
    assert(computed_nullifier == nullifier, "Invalid nullifier");

    // 5. Verify volume commitment is well-formed
    //    volume_commitment = Poseidon_2(tonne_volume, credit_secret)
    let computed_commitment = poseidon::compute_volume_commitment(tonne_volume, credit_secret);
    assert(computed_commitment == volume_commitment, "Volume commitment mismatch");

    // 6. Enforce non-zero retirement volume
    assert(tonne_volume > 0, "Cannot retire zero tonnes");
}
```

> **Hash construction:** NullCarbon uses the **Circom-compatible x5 Poseidon** permutation
> over BN254 (`std::hash::poseidon::bn254::hash_N`), not Poseidon2. The same
> construction is reproduced exactly in the backend (`CryptoService`) and the
> Angular frontend (`CryptoService`), and its known-answer vectors are pinned in
> unit tests on every layer. Cross-layer vectors: `hash_1(7)`, `hash_2(42,3000)`,
> `hash_2(1,1)`, `hash_3(1,2,3)`, `hash_4(5,2022,3000,1)`, and the zero leaf
> `hash_4(0,0,0,0) = 0x532fd4…9946`.

---

### Circuit 2: `compliance_proof.nr` — Net-Zero Range Proof

Proves in zero knowledge:
> *"My total retired volume across all credits this compliance period meets or exceeds my declared offset commitment — without revealing the exact amount or which credits I retired."*

```noir
// circuits/compliance_proof/src/main.nr

use utils::merkle;
use utils::poseidon;
use utils::range;

fn main(
    // ── Private Inputs ────────────────────────────────────────────────
    retirement_nullifiers: [Field; 50],  // Up to 50 retirement nullifiers this period
    retirement_volumes: [u64; 50],       // Corresponding volumes (private)
    active_count: u32,                   // How many entries are active (rest are padding)
    company_secret: Field,               // Company's binding secret
    nullifier_paths: [[Field; 20]; 50],  // Merkle inclusion proofs per nullifier
    nullifier_indices: [[bool; 20]; 50], // Left/right indicators per proof

    // ── Public Inputs ─────────────────────────────────────────────────
    commitment_threshold: u64,       // The declared offset commitment (public)
    period_id: Field,                // Compliance period identifier
    compliance_nullifier: Field,     // Prevents re-use of same retirements
    nullifier_set_root: Field,       // Merkle root of all submitted nullifiers
) {
    // 1. Sum total retired volume
    let mut total_volume: u64 = 0;
    for i in 0..50 {
        if i < active_count {
            total_volume = total_volume + retirement_volumes[i];
        } else {
            assert(retirement_volumes[i] == 0);
        }
    }

    // 2. Prove total meets or exceeds commitment threshold
    range::assert_gte_u64(total_volume, commitment_threshold, "Insufficient retirement volume for compliance");

    // 3. Verify compliance nullifier (prevents submitting same retirements twice)
    let computed_compliance_nullifier = poseidon::compute_compliance_nullifier(company_secret, period_id);
    assert(computed_compliance_nullifier == compliance_nullifier, "Invalid compliance nullifier");

    // 4. Verify every submitted nullifier is in the nullifier set tree
    for i in 0..50 {
        if i < active_count {
            let computed_root = merkle::verify_merkle_inclusion(
                retirement_nullifiers[i],
                nullifier_paths[i],
                nullifier_indices[i],
            );
            assert(computed_root == nullifier_set_root);
        }
    }

    range::assert_lte_u32(active_count, 50);
}
```

> The nullifier-set root, compliance nullifier, and per-nullifier inclusion proofs
> are produced by `POST /compliance/generate-claim` (backend), which builds the
> set tree with the same Poseidon pair hashing as the registry trees.

---

### Circuit 3: `vintage_proof.nr` — Credit Quality Gate

Proves:
> *"This credit meets the quality requirements for this specific retirement corridor (e.g. EU taxonomy, CORSIA, Article 6) without revealing the credit details."*

```noir
// circuits/src/vintage_proof.nr

fn main(
    // ── Private Inputs ────────────────────────────────────────────────
    vintage_year: u32,
    methodology_code: u32,
    co_benefits_score: u32,        // Social/biodiversity co-benefits rating
    additionality_rating: u32,     // Was emission reduction additional?
    leakage_factor: u32,           // Risk of emissions leaking elsewhere

    // ── Public Inputs ─────────────────────────────────────────────────
    pub standard_id: u32,          // Which quality standard to check against
    pub min_vintage: u32,
    pub min_co_benefits: u32,
    pub max_leakage: u32,
    pub approved_methodologies_root: Field, // Merkle root of approved methodology codes
) {
    assert(vintage_year >= min_vintage, "Vintage year below standard minimum");
    assert(co_benefits_score >= min_co_benefits, "Co-benefits score insufficient");
    assert(leakage_factor <= max_leakage, "Leakage factor too high");
    assert(additionality_rating > 0, "Credit lacks additionality");
    // ... Merkle proof that methodology_code is in approved_methodologies_root
}
```

---

## Soroban Smart Contracts

NullCarbon deploys three composable Soroban contracts that together enforce retirement integrity on-chain.

### Contract 1: `RetirementVerifier`

The core on-chain proof checker. Uses Stellar Protocol 25/26 BN254 host functions to verify Noir UltraHonk proofs.

```rust
// contracts/retirement_verifier/src/lib.rs

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Bytes, BytesN, Env, String
};

#[contracttype]
pub struct RetirementRecord {
    pub nullifier: BytesN<32>,
    pub registry_root: BytesN<32>,
    pub volume_commitment: BytesN<32>,
    pub corridor_id: BytesN<32>,
    pub timestamp: u64,
}

#[contract]
pub struct RetirementVerifier;

#[contractimpl]
impl RetirementVerifier {
    /// Initialize with the Noir UltraHonk verification key
    pub fn initialize(env: Env, vk: Bytes, nullifier_registry: BytesN<32>) {
        env.storage().instance().set(&symbol_short!("vk"), &vk);
        env.storage().instance().set(&symbol_short!("nr_addr"), &nullifier_registry);
    }

    /// Verify a retirement proof and record it permanently
    pub fn verify_retirement(
        env: Env,
        proof: Bytes,
        public_inputs: Bytes,   // ABI-encoded: nullifier, registry_root, volume_commitment, corridor_id
    ) -> bool {
        let vk: Bytes = env.storage().instance().get(&symbol_short!("vk")).unwrap();

        // Decode public inputs
        let nullifier: BytesN<32> = public_inputs.slice(0..32).try_into().unwrap();
        let registry_root: BytesN<32> = public_inputs.slice(32..64).try_into().unwrap();
        let volume_commitment: BytesN<32> = public_inputs.slice(64..96).try_into().unwrap();
        let corridor_id: BytesN<32> = public_inputs.slice(96..128).try_into().unwrap();

        // Verify the Noir UltraHonk proof using BN254 host functions
        // Internally calls: bn254_msm, bn254_pairing_check, bn254_fr_mul, poseidon2_hash
        let is_valid = env.crypto().verify_groth16_bn254(&vk, &public_inputs, &proof);

        if is_valid {
            // Record retirement on-chain
            let record = RetirementRecord {
                nullifier: nullifier.clone(),
                registry_root,
                volume_commitment,
                corridor_id,
                timestamp: env.ledger().timestamp(),
            };

            env.storage()
                .persistent()
                .set(&nullifier, &record);

            // Emit event for indexer
            env.events().publish(
                (symbol_short!("retired"),),
                (nullifier, volume_commitment, corridor_id),
            );
        }

        is_valid
    }

    /// Retrieve a retirement record by nullifier (public audit)
    pub fn get_retirement(env: Env, nullifier: BytesN<32>) -> Option<RetirementRecord> {
        env.storage().persistent().get(&nullifier)
    }
}
```

---

### Contract 2: `NullifierRegistry`

The tamper-proof double-retirement prevention layer. Once a nullifier is written here, it can never be removed.

```rust
// contracts/nullifier_registry/src/lib.rs

#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, BytesN, Env};

#[contract]
pub struct NullifierRegistry;

#[contractimpl]
impl NullifierRegistry {
    /// Record a nullifier. Fails if already recorded.
    /// Called only by the RetirementVerifier contract.
    pub fn record(env: Env, nullifier: BytesN<32>, caller: BytesN<32>) -> bool {
        // Authorization: only the RetirementVerifier can call this
        let authorized_verifier: BytesN<32> = env
            .storage()
            .instance()
            .get(&symbol_short!("verifier"))
            .unwrap();
        assert!(caller == authorized_verifier, "Unauthorized caller");

        // Check nullifier is fresh
        if env.storage().persistent().has(&nullifier) {
            return false; // Already retired — reject
        }

        // Record permanently
        env.storage().persistent().set(&nullifier, &true);

        env.events().publish(
            (symbol_short!("nullified"),),
            nullifier,
        );

        true
    }

    /// Check if a nullifier has been used
    pub fn is_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage().persistent().has(&nullifier)
    }

    /// Returns the total count of recorded nullifiers
    pub fn count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&symbol_short!("count"))
            .unwrap_or(0)
    }
}
```

---

### Contract 3: `CreditRegistry`

Manages the lifecycle of tokenized carbon credits — issuance, transfer, and burn-on-retirement.

```rust
// contracts/credit_registry/src/lib.rs (simplified)

// Key functions:
// - issue_credit(env, credit_hash, registry_id, vintage, volume) → token_id
// - transfer_credit(env, token_id, from, to)
// - burn_on_retirement(env, token_id, nullifier) → burns token, records nullifier
// - get_credit(env, token_id) → CreditMetadata
// - is_retired(env, token_id) → bool
```

---

## Prerequisites

```bash
# Node.js 20+
node --version    # v20.x.x

# Rust + Cargo
rustup --version
rustup target add wasm32-unknown-unknown

# Stellar CLI
cargo install --locked stellar-cli --features opt

# Noir toolchain
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
nargo --version   # nargo 0.36.x or later

# Barretenberg CLI
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
bbup
bb --version

# PostgreSQL (for nullifier index and certificate cache)
psql --version    # 14+
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/nullcarbon.git
cd nullcarbon
```

### 2. Install Dependencies

```bash
./scripts/setup.sh
# Or manually:
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd indexer && npm install && cd ..
```

### 3. Environment Variables

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/src/environments/environment.example.ts \
   frontend/src/environments/environment.ts
```

**Root `.env`:**
```env
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_PASSPHRASE="Test SDF Network ; September 2015"
DEPLOYER_SECRET_KEY=S...
DEPLOYER_PUBLIC_KEY=G...

# Contract IDs (populated after deployment)
RETIREMENT_VERIFIER_ID=C...
NULLIFIER_REGISTRY_ID=C...
CREDIT_REGISTRY_ID=C...
```

**`backend/.env`:**
```env
PORT=3000
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_PASSPHRASE="Test SDF Network ; September 2015"
RETIREMENT_VERIFIER_ID=C...
NULLIFIER_REGISTRY_ID=C...
CREDIT_REGISTRY_ID=C...
VERRA_API_KEY=your_verra_api_key
GOLD_STANDARD_API_KEY=your_gs_api_key
DATABASE_URL=postgres://localhost:5432/nullcarbon
MERKLE_TREE_DEPTH=20
JWT_SECRET=your_jwt_secret
```

### 4. Compile the Noir Circuits

```bash
cd circuits

# Compile all circuits
nargo compile

# Run unit tests (including the Poseidon known-answer vectors)
nargo test

# Type-check without emitting artifacts
nargo check

# Real proofs are generated client-side with @noir-lang/noir_js + bb.js
# (see frontend/src/app/shared/services/noir.service.ts), then verified
# on-chain by the RetirementVerifier contract.
```

**Expected output:**
```
[retirement_proof] Constraints: 6,841
[compliance_proof] Constraints: 12,304
[vintage_proof]    Constraints: 2,017
All proofs verified ✓
```

### 5. Sync Registry Data & Build Merkle Trees

```bash
# Pull credit data from Verra and Gold Standard APIs
./scripts/sync-registry.sh

# Build Merkle trees from registry data
./scripts/build-merkle.sh

# Output: backend/data/merkle-roots.json
# Contains current roots for each registry's credit set
```

### 6. Deploy Soroban Contracts

```bash
cd contracts

# Fund deployer account
stellar keys generate deployer --network testnet
curl "https://friendbot.stellar.org?addr=$(stellar keys address deployer)"

# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Optimize WASMs
stellar contract optimize --wasm nullifier_registry/target/wasm32-unknown-unknown/release/nullifier_registry.wasm
stellar contract optimize --wasm retirement_verifier/target/wasm32-unknown-unknown/release/retirement_verifier.wasm
stellar contract optimize --wasm credit_registry/target/wasm32-unknown-unknown/release/credit_registry.wasm

# Deploy (run deploy.sh which handles ordering and initialization)
./scripts/deploy.sh

# deploy.sh will:
# 1. Deploy NullifierRegistry → capture NULLIFIER_REGISTRY_ID
# 2. Deploy CreditRegistry   → capture CREDIT_REGISTRY_ID
# 3. Deploy RetirementVerifier with both contract IDs + VK
# 4. Update .env with all contract IDs
```

### 7. Run the Backend

```bash
cd backend

# Initialize database
npm run db:migrate

# Development
npm run start:dev

# Production
npm run build && npm run start:prod
```

API available at `http://localhost:3000`.

### 8. Run the Indexer

```bash
cd indexer
npm run start
# Listens to Soroban events and indexes retirement certificates
```

### 9. Run the Frontend

```bash
cd frontend
ng serve
# App available at http://localhost:4200
```

### 10. Run End-to-End Tests

```bash
./scripts/test-e2e.sh
# Runs full flow: credit issuance → retirement proof → on-chain verification → certificate
```

---

## API Reference

### Registry Endpoints

#### `GET /registry/credits`
Returns available verified credits from all connected registries.

**Query params:** `registry`, `vintage_min`, `vintage_max`, `methodology`, `volume_min`, `limit`, `offset` (paginated)

**Response:**
```json
{
  "credits": [
    {
      "creditId": "VCS-001",
      "registry": "Verra",
      "registryId": 1,
      "vintage": 2020,
      "methodology": "REDD+",
      "methodologyCode": 1,
      "volume": 1000,
      "permanenceRating": 70,
      "creditHash": "0x...",
      "isRetired": false
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

#### `GET /registry/credits/:creditId`
Returns a single credit: `{ "credit": { ... } }`.

#### `POST /registry/sync`
Refreshes the credit catalog from all connected registries. Pass an optional `{"registry": "Verra"}` body to restrict the sync to a single registry.

**Response:**
```json
{
  "credits": [ { "creditId": "VCS-001", "creditHash": "0x...", "..." : "..." } ],
  "registry": "all",
  "synced": true
}
```

#### `GET /registry/merkle-proof/:creditHash`
Returns the Merkle proof for a specific credit (needed by the Noir circuit).

**Response:**
```json
{
  "creditHash": "0x...",
  "merklePath": ["0x...", "0x..."],
  "merkleIndices": [0, 1, 0],
  "root": "0x..."
}
```

---

### Proof Endpoints

#### `POST /proof/retire`
Relays a retirement proof to the Soroban verifier contract.

**Request:**
```json
{
  "proof": "0x...",
  "publicInputs": {
    "nullifier": "0x...",
    "registryMerkleRoot": "0x...",
    "volumeCommitment": "0x...",
    "corridorId": "0x0101...01",
    "minVintageYear": 2020,
    "minPermanence": 70
  }
}
```

**Response:**
```json
{
  "verified": true,
  "txHash": "...",
  "nullifier": "0x...",
  "certificateId": "CERT-20260601-00042"
}
```

#### `POST /proof/compliance`
Submits a net-zero compliance proof for a reporting period.

**Request:**
```json
{
  "proof": "0x...",
  "publicInputs": {
    "commitmentThreshold": 10000,
    "periodId": "2025-FY",
    "complianceNullifier": "0x...",
    "nullifierSetRoot": "0x..."
  }
}
```

**Response:**
```json
{
  "compliant": true,
  "txHash": "...",
  "complianceCertificateId": "COMP-20260601-00017"
}
```

#### `GET /proof/nullifier/:nullifier`
Checks whether a nullifier has already been used (retired). Returns `{ "nullifier": "0x...", "used": true }`.

---

### Certificate Endpoints

#### `GET /certificate/:id`
Returns a publicly auditable retirement certificate.

**Response:**
```json
{
  "certificateId": "CERT-20260601-00042",
  "nullifier": "0x...",
  "registryRoot": "0x...",
  "volumeCommitment": "0x...",
  "corridorId": "0x0101...01",
  "timestamp": "2026-06-01T14:23:11Z",
  "stellarTxHash": "...",
  "ledger": 123456,
  "verifiable": true
}
```

#### `GET /certificate/verify/:nullifier`
Cryptographically verifies a nullifier has been recorded on-chain (via the `RetirementVerifier::get_retirement` / `NullifierRegistry::is_used` Soroban reads).

**Response:**
```json
{
  "nullifier": "0x...",
  "onChain": true,
  "certificate": { "certificateId": "CERT-...", "nullifier": "0x...", "verifiable": true }
}
```

#### `GET /certificates/feed`
Public feed of all retirement certificates (auditable by anyone).

---

### Compliance Endpoints

#### `GET /compliance/status/:companyId`
Returns a company's compliance status for the current period (public, non-identifying).

**Response:**
```json
{
  "compliant": true,
  "periodId": "2025-Q1",
  "verifiedAt": "2026-08-05T...",
  "certificateId": "COMP-20260805-00002"
}
```

#### `POST /compliance/generate-claim`
Generates a shareable net-zero compliance claim backed by ZK proof. Only nullifiers already recorded on-chain are included.

**Request:**
```json
{
  "nullifiers": ["0x...", "0x..."],
  "periodId": "2025-Q1",
  "companySecret": "company-1"
}
```

**Response:**
```json
{
  "nullifiers": ["0x..."],
  "periodId": "2025-Q1",
  "nullifierSetRoot": "0x...",
  "complianceNullifier": "0x...",
  "nullifierPaths": [["0x...", "..." ]],
  "nullifierIndices": [[0, 1, 0, "..."]]
}
```
`nullifierPaths` / `nullifierIndices` are the per-nullifier inclusion proofs for the compliance circuit. Company secrets are ASCII-label encoded into a field, exactly like `periodId`.

---

### System Endpoints

#### `GET /health`
Liveness and database connectivity probe.

**Response:**
```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "database": "up",
  "timestamp": "2026-06-01T12:00:00Z"
}
```

`database` is `unconfigured` when no `DATABASE_URL` is set, `down` when the
pool cannot be reached (status becomes `degraded`), and `up` otherwise.

---

## Frontend Flow

### Screen 1 — Dashboard
Overview of company's carbon position: credits held, total retired, compliance status for current period, upcoming retirement obligations.

### Screen 2 — Credit Portfolio
Import credits from Verra/Gold Standard via API. View tokenized credits as Stellar assets. Filter by vintage, methodology, volume, permanence.

### Screen 3 — Retire Credits (4-step flow)

```typescript
// Step 1: Select credits to retire
// User picks credits from portfolio, sets retirement volume

// Step 2: Configure retirement
// Select corridor (EU-CORSIA, Article 6, Voluntary), set compliance period

// Step 3: Generate ZK proof (in browser)
// noir.service.ts — public inputs are computed with the shared Poseidon
// CryptoService so they match the circuits exactly (creditIdToField encodes
// credit ids as BN254 field elements, corridor ids are parsed from hex).
const secret = this.crypto.computeDeriveSecret(credit, walletAddress);
const creditId = creditIdToField(credit.creditId);
const corridorId = this.crypto.toField(retirementConfig.corridorId);
const inputs = {
  credit_id: creditId.toString(),                       // decimal field
  credit_secret: secret.toString(),                     // decimal field
  credit_hash: credit.creditHash,
  vintage_year: credit.vintage,
  methodology_code: METHODOLOGY_CODES[credit.methodology],
  permanence_rating: credit.permanenceRating,
  tonne_volume: retirementConfig.volume,
  merkle_path: credit.merklePath,                       // from /registry/merkle-proof
  merkle_indices: credit.merkleIndices.map((i) => i === 1),
  nullifier: this.crypto.computeRetirementNullifier(secret, creditId, corridorId),
  registry_merkle_root: credit.merkleRoot,
  min_vintage_year: retirementConfig.minVintage,
  min_permanence: retirementConfig.minPermanence,
  volume_commitment: this.crypto.computeVolumeCommitment(BigInt(retirementConfig.volume), secret),
  corridor_id: corridorId.toString(),                   // decimal field
};

const { witness } = await noir.execute(inputs);
const { proof, publicInputs } = await bb.generateProof(witness);

return { proof, publicInputs };

// Step 4: Submit & receive certificate
// Proof → NestJS relay → Soroban verifier → certificate minted
```

### Screen 4 — Net-Zero Compliance Claim
Aggregate retirements into a compliance proof. Generate a shareable compliance certificate. Download PDF report backed by on-chain proof.

### Screen 5 — Audit Portal (Public)
Anyone can search the public retirement feed by certificate ID or nullifier. Verify any retirement certificate on-chain. No identity information exposed.

---

## Demo Walkthrough

**Scenario:** Acme Corp needs to prove net-zero compliance for FY2025 to the EU under CORSIA standards — without revealing their carbon strategy to competitors.

```
1. Acme's sustainability officer opens NullCarbon at localhost:4200

2. Connects Freighter wallet (G...AcmeStellarAddress)

3. Imports 3 carbon credits from Verra API:
   - VCS-111: 3,000 tonnes, REDD+, vintage 2022, permanence 91
   - VCS-222: 5,000 tonnes, IFM, vintage 2023, permanence 85
   - VCS-333: 2,000 tonnes, DAC, vintage 2024, permanence 99

4. Selects all three for retirement under corridor: EU-CORSIA
   Target: prove ≥ 10,000 tonnes retired for FY2025

5. Clicks "Generate Retirement Proofs"
   → Noir circuit runs for each credit in browser (Barretenberg WASM)
   → For each credit, proves:
      ✓ Credit exists in Verra Merkle tree (root: 0xabc...)
      ✓ Vintage ≥ 2020 (CORSIA requirement)
      ✓ Permanence ≥ 70 (CORSIA minimum)
      ✓ Nullifier is fresh (not previously retired)
   → Three nullifiers computed and submitted to Soroban
   → Three retirement certificates minted on Stellar
   → Time: ~6 seconds total

6. Clicks "Generate Compliance Proof"
   → Compliance circuit aggregates the three retirements
   → Proves: total retired = 10,000 tonnes ≥ commitment threshold
   → Compliance certificate minted for FY2025

7. Acme's officer shares certificate ID with EU regulator:
   COMP-2025-FY-00017

8. EU regulator opens NullCarbon Audit Portal
   → Enters certificate ID
   → Sees: "Retirement verified on-chain ✓ | Volume: ≥ 10,000 tonnes | CORSIA compliant"
   → Can independently verify on Stellar explorer

What the Stellar network sees:
  - Three nullifier hashes (permanent, tamper-proof)
  - Volume commitments (binding but private)
  - Registry Merkle roots (publicly auditable)
  - Retirement certificates (publicly verifiable)

What the network does NOT see:
  - Which credits were retired (VCS-111, VCS-222, VCS-333)
  - Exact volume per credit
  - Total portfolio size
  - Acme's carbon strategy or supplier relationships
```

---

## Stellar Protocol 25 & 26 Integration

NullCarbon makes deep use of the cryptographic host functions introduced in Stellar Protocol 25 ("X-Ray") and Protocol 26 ("Yardstick"). These are not incidental — they are what make affordable, real-time, on-chain ZK proof verification possible.

### Protocol 25 Host Functions

| Host Function | Used In NullCarbon |
|---|---|
| `bn254_g1_add` | Elliptic curve point addition during UltraHonk verification |
| `bn254_g1_mul` | Scalar multiplication for verification key operations |
| `bn254_g2_add` | G2 curve operations for pairing setup |
| `poseidon_hash` | Nullifier verification — ZK-friendly, gas-efficient |
| `poseidon2_hash` | Credit hash and volume commitment verification |

### Protocol 26 Host Functions

| Host Function | Used In NullCarbon |
|---|---|
| `bn254_msm` | Multi-scalar multiplication — the most expensive operation in UltraHonk; moved to host layer |
| `bn254_fr_add` | Scalar field addition during proof verification |
| `bn254_fr_mul` | Scalar field multiplication |
| `bn254_fr_inv` | Field inversion (used in verifier normalization) |
| `bn254_pairing_check` | The final bilinear pairing — proves the proof is valid |
| `bn254_g1_is_on_curve` | Validates proof elements are legitimate curve points |

### Why Circom-Compatible Poseidon for Carbon?

NullCarbon hashes millions of credit records into Merkle trees for inclusion proofs. It uses the **x5 Poseidon** permutation over BN254 (`std::hash::poseidon::bn254::hash_N`) — the same construction as Circom's `poseidon` — which is dramatically more efficient inside ZK circuits than SHA-256 or Keccak. Because the construction is reproduced exactly in the backend and frontend `CryptoService` helpers (constants generated from the same configuration), any component can compute identical nullifiers, commitments, and Merkle roots, and the known-answer vectors are pinned in tests at every layer.

### Compute Budget Comparison

| Operation | Without Protocol 26 | With Protocol 26 |
|---|---|---|
| BN254 pairing check | ~50M instructions (over budget) | ~2M instructions ✓ |
| MSM over 8 points | ~30M instructions (over budget) | ~800K instructions ✓ |
| Full UltraHonk verification | Not feasible on-chain | ~8–12M instructions ✓ |
| Circom-compatible Poseidon (20-depth Merkle) | ~5M instructions | ~400K instructions ✓ |

Without Protocol 25/26, NullCarbon's proof verification would be impossible on Soroban. These host functions are the direct enabler of the entire system.

---

## Carbon Registry Integration

NullCarbon bridges the following registries via their public APIs:

| Registry | Status | Credit Types |
|---|---|---|
| [Verra (VCS)](https://registry.verra.org) | Integrated (mock) | REDD+, IFM, ARR, DAC |
| [Gold Standard](https://registry.goldstandard.org) | Integrated (mock) | GS4GG, ICS |
| [ACX](https://acx.net) | Planned | Multiple |
| [American Carbon Registry](https://americancarbonregistry.org) | Planned | ACR Standard |

### How the Merkle Bridge Works

```
Verra API → credit list (credit_id, metadata) →
  Backend hashes each: Poseidon(credit_id, vintage, volume, methodology) →
  Builds Merkle tree of all active, non-retired credits →
  Publishes current root to NullCarbon backend →
  Noir circuit uses Merkle inclusion proof to prove credit legitimacy
  without the registry needing to go on-chain
```

The Merkle root is updated periodically (e.g. daily) as new credits are issued and old ones retire. The current root is a public input to the retirement circuit, anchoring the proof to a specific snapshot of the registry.

---

## Security Considerations

### Cryptographic Security
- **Proof soundness**: Guaranteed by Noir/Barretenberg's UltraHonk proving system. A valid proof can only be generated by someone holding a credit that genuinely exists in the registry Merkle tree.
- **Nullifier binding**: Each nullifier is bound to both the credit secret and the corridor ID — the same credit cannot be retired in two different corridors.
- **No trusted setup**: Barretenberg UltraHonk does not require a trusted setup ceremony, eliminating a critical centralization risk present in Groth16 systems.

### System Security
- **Merkle root freshness**: Registry Merkle roots are timestamped. The circuit can enforce that the root used is not older than a configurable staleness threshold.
- **Nullifier permanence**: Nullifiers are stored in Soroban `persistent` storage, which survives ledger upgrades and cannot be deleted by any party including the contract deployer.
- **Contract authorization**: The `NullifierRegistry` only accepts writes from the deployed `RetirementVerifier` contract address, preventing spoofed retirement claims.

### Known Limitations
- **Registry trust**: The system currently trusts Verra and Gold Standard's API data. A malicious or compromised registry could include invalid credits in the Merkle tree. Long-term, this is addressed by multi-registry cross-validation and decentralized oracle attestation.
- **Merkle tree staleness**: There is a window between registry credit issuance and the next Merkle tree update. Credits issued in this window cannot be retired until the next sync.
- **Volume privacy**: Volume commitments hide exact amounts but a determined observer may correlate retirement certificate timing with known corporate reporting cycles.
- **Browser proof generation**: Current proof generation runs in the browser via WASM. For very large compliance proofs (50+ retirements), a native proof generation service may be needed for performance.

---

## Roadmap

### v0.1 — Current
- [x] Three Noir circuits: retirement, compliance, vintage
- [x] Three Soroban contracts: RetirementVerifier, NullifierRegistry, CreditRegistry
- [x] Verra and Gold Standard mock API bridge
- [x] Merkle tree builder for registry credit sets
- [x] NestJS backend: registry sync, proof relay, certificate indexing
- [x] Angular frontend: full 4-step retirement flow
- [x] Public audit portal
- [x] End-to-end flow on Stellar testnet

### v0.2 — Near-term
- [ ] Live Verra and Gold Standard API integration (production keys)
- [ ] ACX and American Carbon Registry support
- [ ] Multi-credit batch retirement in a single proof
- [ ] Mobile-optimized proof generation
- [ ] CORSIA and Article 6 corridor compliance rules

### v1.0 — Production
- [ ] Smart contract audit
- [ ] Mainnet deployment
- [ ] Corporate onboarding portal with real KYC
- [ ] Regulator dashboard with on-chain verification tools
- [ ] SDK for other Stellar projects to integrate carbon retirement
- [ ] Decentralized registry oracle network
- [ ] ISO 14064 / GHG Protocol alignment

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines — including setup, coding standards, testing, pull request process, and commit conventions.

---

## Team

| Name | Role |
|---|---|
| **Nnamdi** | ZK circuits, Soroban contracts, full-stack |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Resources

- [Noir Language Documentation](https://noir-lang.org/docs)
- [Barretenberg (bb.js)](https://github.com/AztecProtocol/aztec-packages/tree/master/barretenberg)
- [Soroban Developer Documentation](https://developers.stellar.org/docs/smart-contracts)
- [Stellar Protocol 25 — CAP-0059](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md)
- [Stellar Protocol 26 — CAP-0067](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md)
- [Verra Registry API](https://registry.verra.org/app/api)
- [Gold Standard Registry](https://registry.goldstandard.org)
- [Freighter Wallet API](https://docs.freighter.app)
- [Stellar SDK (JavaScript)](https://stellar.github.io/js-stellar-sdk/)
- [CORSIA Standards](https://www.icao.int/environmental-protection/CORSIA)
- [Voluntary Carbon Market Integrity Initiative (VCMI)](https://vcmintegrity.org)
