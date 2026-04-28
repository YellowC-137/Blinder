#!/bin/bash
# iOS regression test
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../_lib.sh"

SAMPLE="$DIR/sample-app"
EXPECTED="$DIR/expected-secrets.json"

echo "═══ iOS Build Regression ═══"
require_dir "$SAMPLE"

if ! command -v xcodebuild >/dev/null 2>&1; then
  color_yellow "[SKIP] xcodebuild not found (macOS Xcode 필요)"
  exit 0
fi

BACKUP=$(backup_dir "$SAMPLE")
trap "restore_dir '$SAMPLE' '$BACKUP'" EXIT INT TERM

run_blinder_blind "$SAMPLE"
verify_expected "$SAMPLE" "$EXPECTED"

color_blue "→ xcodebuild (Debug, simulator)"
SCHEME=$(cd "$SAMPLE" && xcodebuild -list 2>/dev/null | awk '/Schemes:/{flag=1; next} flag && NF{print $1; exit}')
if [ -z "$SCHEME" ]; then
  color_red "FAIL: scheme 자동 검출 실패"
  exit 1
fi

(cd "$SAMPLE" && xcodebuild \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/regression \
  build CODE_SIGNING_ALLOWED=NO ENABLE_USER_SCRIPT_SANDBOXING=NO 2>&1 | tail -20)

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  color_red "FAIL: iOS build broken"
  exit 1
fi
color_green "PASS: iOS build"
