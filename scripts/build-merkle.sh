#!/usr/bin/env bash
set -euo pipefail

# ─── NullCarbon — Build Merkle Trees ────────────────────────────────────
# Triggers registry sync and Merkle tree rebuild via the backend API.
# Usage: ./scripts/build-merkle.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }

API_BASE="${API_BASE_URL:-http://localhost:3000}"

echo "================================================"
echo "  NullCarbon — Merkle Tree Builder"
echo "================================================"
echo "  API Base: ${API_BASE}"
echo ""

# Step 1: Sync registry data
echo "--- Step 1: Syncing registry data ---"
SYNC_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/registry/sync" 2>/dev/null || true)
SYNC_CODE=$(echo "${SYNC_RESPONSE}" | tail -1)
SYNC_BODY=$(echo "${SYNC_RESPONSE}" | sed '$d')

if [ "${SYNC_CODE}" = "200" ] || [ "${SYNC_CODE}" = "201" ]; then
  log "Registry sync complete"
else
  warn "Registry sync returned HTTP ${SYNC_CODE} (backed may not be running)"
  echo "  ${SYNC_BODY}"
fi

# Step 2: Rebuild Merkle trees
echo ""
echo "--- Step 2: Rebuilding Merkle trees ---"
MERKLE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/merkle/rebuild" 2>/dev/null || true)
MERKLE_CODE=$(echo "${MERKLE_RESPONSE}" | tail -1)
MERKLE_BODY=$(echo "${MERKLE_RESPONSE}" | sed '$d')

if [ "${MERKLE_CODE}" = "200" ] || [ "${MERKLE_CODE}" = "201" ]; then
  log "Merkle trees rebuilt"
  echo ""
  echo "  Merkle Roots:"
  echo "${MERKLE_BODY}" | python3 -m json.tool 2>/dev/null || echo "${MERKLE_BODY}"
else
  warn "Merkle rebuild returned HTTP ${MERKLE_CODE}"
  echo "  ${MERKLE_BODY}"
fi

echo ""
echo "Done."
