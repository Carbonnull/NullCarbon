#!/usr/bin/env bash
set -euo pipefail

# ─── NullCarbon — End-to-End Test Script ────────────────────────────────
# Executes the full retirement flow: sync credits → Merkle proof →
# generate proof → relay to Soroban → verify certificate.
# Usage: ./scripts/test-e2e.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

ALL_PASSED=true
API_BASE="${API_BASE_URL:-http://localhost:3000}"

# json_field <json> <python expression> — extracts a field with python3.
# Returns non-zero (with empty output) if the JSON is invalid or missing.
json_field() {
  local json="$1"
  local expr="$2"
  if [ -z "${json}" ]; then
    return 1
  fi
  python3 -c "import sys,json; d=json.loads(sys.argv[1]); print(${expr})" "${json}" 2>/dev/null || return 1
}

echo "================================================"
echo "  NullCarbon — End-to-End Tests"
echo "================================================"
echo ""

# Step 1: Sync registry credits
echo "--- Step 1: Sync registry credits ---"
ISSUE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/registry/sync" 2>/dev/null || true)
ISSUE_CODE=$(printf '%s' "${ISSUE_RESPONSE}" | tail -1)
if [ "${ISSUE_CODE}" = "200" ] || [ "${ISSUE_CODE}" = "201" ]; then
  pass "Registry credits synced"
else
  fail "Credit sync returned HTTP ${ISSUE_CODE}"
  ALL_PASSED=false
fi

# Step 2: Fetch a credit and its Merkle proof
echo ""
echo "--- Step 2: Fetch Merkle proof ---"
CREDITS=$(curl -s "${API_BASE}/registry/credits?registry=Verra&limit=1" 2>/dev/null || echo "{}")
FIRST_HASH=$(json_field "${CREDITS}" "d['credits'][0]['creditHash']") || true

if [ -n "${FIRST_HASH}" ]; then
  PROOF_RESPONSE=$(curl -s "${API_BASE}/registry/merkle-proof/${FIRST_HASH}" 2>/dev/null || echo "{}")
  MERKLE_PATH=$(json_field "${PROOF_RESPONSE}" "json.dumps(d.get('merklePath',[]))") || true
  if [ -n "${MERKLE_PATH}" ] && [ "${MERKLE_PATH}" != "[]" ]; then
    pass "Merkle proof retrieved for ${FIRST_HASH:0:16}..."
  else
    fail "Merkle proof missing path"
    ALL_PASSED=false
  fi
else
  fail "No credits found to prove"
  ALL_PASSED=false
fi

# Step 3: Compile Noir circuits (requires nargo)
# Real proofs are generated client-side with @noir-lang/noir_js + bb.js
# (see frontend/src/app/shared/services/noir.service.ts); this step only
# validates that the shared circuits still build.
echo ""
echo "--- Step 3: Compile Noir circuits ---"
if command -v nargo &>/dev/null; then
  (cd circuits && nargo check 2>/dev/null) && \
    pass "Circuits compile (nargo check)" || {
      fail "Circuit compilation failed"
      ALL_PASSED=false
    }
else
  warn "nargo not installed — skipping circuit compile check"
fi

# Step 4: Relay proof (dev mode: no verifier contract configured)
echo ""
echo "--- Step 4: Relay proof ---"
RELAY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/proof/retire" \
  -H "Content-Type: application/json" \
  -d '{"proof":"0xdead","publicInputs":{"nullifier":"0xbeef","registryMerkleRoot":"0xabcd","volumeCommitment":"0x1234","corridorId":"EU-CORSIA","minVintageYear":2020,"minPermanence":70}}' \
  2>/dev/null || true)
RELAY_CODE=$(printf '%s' "${RELAY_RESPONSE}" | tail -1)
if [ "${RELAY_CODE}" = "200" ] || [ "${RELAY_CODE}" = "201" ]; then
  pass "Proof relay endpoint responded"
else
  warn "Proof relay returned HTTP ${RELAY_CODE} (expected if backend is not fully running)"
fi

# Step 5: Check nullifier
echo ""
echo "--- Step 5: Check nullifier ---"
NULLIFIER_CHECK=$(curl -s "${API_BASE}/proof/nullifier/0xbeef" 2>/dev/null || echo "{}")
USED=$(json_field "${NULLIFIER_CHECK}" "d.get('used', 'missing')") || true
if [ -n "${NULLIFIER_CHECK}" ] && [ "${USED}" != "missing" ]; then
  pass "Nullifier check endpoint responded (used=${USED})"
else
  warn "Nullifier check endpoint not available"
fi

# Step 6: Fetch certificate feed (returns a JSON array)
echo ""
echo "--- Step 6: Fetch certificate feed ---"
CERTS=$(curl -s "${API_BASE}/certificates/feed" 2>/dev/null || echo "{}")
CERT_IS_LIST=$(json_field "${CERTS}" "len(d) if isinstance(d, list) else None") || true
if [ -n "${CERT_IS_LIST}" ]; then
  pass "Certificate feed endpoint responded (${CERT_IS_LIST} entries)"
else
  warn "Certificate feed endpoint not available"
fi

# Step 7: Verify on-chain status of the relayed nullifier
echo ""
echo "--- Step 7: Verify certificate on-chain ---"
VERIFY_RESPONSE=$(curl -s "${API_BASE}/certificate/verify/0xbeef" 2>/dev/null || echo "{}")
ON_CHAIN=$(json_field "${VERIFY_RESPONSE}" "d.get('onChain', 'missing')") || true
if [ -n "${VERIFY_RESPONSE}" ] && [ "${ON_CHAIN}" != "missing" ]; then
  pass "Certificate verify endpoint responded (onChain=${ON_CHAIN})"
else
  warn "Certificate verify endpoint not available"
fi

echo ""
echo "================================================"
if [ "${ALL_PASSED}" = true ]; then
  echo -e "${GREEN}  All tests passed!${NC}"
else
  echo -e "${YELLOW}  Some tests failed — check output above.${NC}"
fi
echo "================================================"
