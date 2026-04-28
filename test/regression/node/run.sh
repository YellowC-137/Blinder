#!/bin/bash
# Node.js regression test
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../_lib.sh"

SAMPLE="$DIR/sample-app"
EXPECTED="$DIR/expected-secrets.json"

echo "═══ Node.js Regression ═══"
require_dir "$SAMPLE"

if ! command -v node >/dev/null 2>&1; then
  color_yellow "[SKIP] node not found"
  exit 0
fi

BACKUP=$(backup_dir "$SAMPLE")
trap "restore_dir '$SAMPLE' '$BACKUP'" EXIT INT TERM

run_blinder_blind "$SAMPLE"
verify_expected "$SAMPLE" "$EXPECTED"

# Smoke: parse the file with Node (no install needed for syntax check).
color_blue "→ node --check on rewritten index.js"
if ! node --check "$SAMPLE/index.js"; then
  color_red "FAIL: rewritten index.js has syntax error"
  exit 1
fi
color_green "PASS: Node.js syntax OK"

# Smoke 2: actually require with .env loaded — confirm process.env.* resolve.
color_blue "→ runtime smoke (dotenv-style env load + require)"
node -e "
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join('$SAMPLE', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)\$/);
      if (m) process.env[m[1]] = m[2];
    }
  }
  const mod = require(path.join('$SAMPLE', 'index.js'));
  const cfg = mod.configure();
  if (!cfg.stripe || !cfg.github || !cfg.slackWebhook) {
    console.error('FAIL: env values not resolved');
    process.exit(1);
  }
  console.log('  PASS: process.env.* resolved at runtime');
"
color_green "PASS: Node.js runtime smoke"
