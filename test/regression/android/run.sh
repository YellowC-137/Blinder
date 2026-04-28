#!/bin/bash
# Android regression test
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../_lib.sh"

SAMPLE="$DIR/sample-app"
EXPECTED="$DIR/expected-secrets.json"

echo "═══ Android Build Regression ═══"
require_dir "$SAMPLE"

if [ ! -f "$SAMPLE/gradlew" ]; then
  color_red "FAIL: gradlew 없음 ($SAMPLE)"
  exit 1
fi

BACKUP=$(backup_dir "$SAMPLE")
trap "restore_dir '$SAMPLE' '$BACKUP'" EXIT INT TERM

run_blinder_blind "$SAMPLE"
verify_expected "$SAMPLE" "$EXPECTED"

color_blue "→ ./gradlew assembleDebug"
(cd "$SAMPLE" && chmod +x ./gradlew && ./gradlew assembleDebug --no-daemon 2>&1 | tail -20)

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  color_red "FAIL: Android build broken"
  exit 1
fi
color_green "PASS: Android build"
