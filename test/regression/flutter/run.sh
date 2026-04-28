#!/bin/bash
# Flutter regression test
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../_lib.sh"

SAMPLE="$DIR/sample-app"
EXPECTED="$DIR/expected-secrets.json"

echo "═══ Flutter Build Regression ═══"
require_dir "$SAMPLE"

if ! command -v flutter >/dev/null 2>&1; then
  color_yellow "[SKIP] flutter SDK not found"
  exit 0
fi

BACKUP=$(backup_dir "$SAMPLE")
trap "restore_dir '$SAMPLE' '$BACKUP'" EXIT INT TERM

run_blinder_blind "$SAMPLE"
verify_expected "$SAMPLE" "$EXPECTED"

color_blue "→ flutter pub get"
(cd "$SAMPLE" && flutter pub get 2>&1 | tail -10)

color_blue "→ flutter build apk --debug"
(cd "$SAMPLE" && flutter build apk --debug --dart-define-from-file=.env 2>&1 | tail -20)

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  color_red "FAIL: Flutter build broken"
  exit 1
fi
color_green "PASS: Flutter build"
