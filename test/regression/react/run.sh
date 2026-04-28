#!/bin/bash
# React regression test (Vite minimal — no real Vite install required)
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../_lib.sh"

SAMPLE="$DIR/sample-app"
EXPECTED="$DIR/expected-secrets.json"

echo "═══ React Regression ═══"
require_dir "$SAMPLE"

if ! command -v node >/dev/null 2>&1; then
  color_yellow "[SKIP] node not found"
  exit 0
fi

BACKUP=$(backup_dir "$SAMPLE")
trap "restore_dir '$SAMPLE' '$BACKUP'" EXIT INT TERM

run_blinder_blind "$SAMPLE"
verify_expected "$SAMPLE" "$EXPECTED"

color_blue "→ verify Vite accessor (import.meta.env.VITE_*) injected"
CFG="$SAMPLE/src/config.js"
if grep -q '"pk_live_abcdefghijklmnop' "$CFG"; then
  color_red "FAIL: hardcoded Stripe key still present in config.js"
  exit 1
fi
if ! grep -c 'import.meta.env.VITE_' "$CFG" >/dev/null; then
  color_red "FAIL: no Vite accessors injected"
  cat "$CFG"
  exit 1
fi
INJECTED=$(grep -c 'import.meta.env.VITE_' "$CFG")
if [ "$INJECTED" -lt 2 ]; then
  color_red "FAIL: expected ≥2 Vite accessors, got $INJECTED"
  cat "$CFG"
  exit 1
fi
color_green "PASS: Vite accessors injected ($INJECTED found)"

color_blue "→ syntax check on rewritten config.js (node --check ESM)"
# Note: runtime exec would fail because import.meta.env is undefined outside
# the Vite bundler. Syntax-only check is the correct gate here.
if ! node --check "$CFG"; then
  color_red "FAIL: rewritten config.js has syntax error"
  exit 1
fi
color_green "PASS: React (Vite) syntax OK"
