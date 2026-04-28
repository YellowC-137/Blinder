#!/bin/bash
# Java regression test
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../_lib.sh"

SAMPLE="$DIR/sample-app"
EXPECTED="$DIR/expected-secrets.json"

echo "═══ Java Regression ═══"
require_dir "$SAMPLE"

if ! command -v javac >/dev/null 2>&1; then
  color_yellow "[SKIP] javac not found (JDK 필요)"
  exit 0
fi

BACKUP=$(backup_dir "$SAMPLE")
trap "restore_dir '$SAMPLE' '$BACKUP'" EXIT INT TERM

run_blinder_blind "$SAMPLE"
verify_expected "$SAMPLE" "$EXPECTED"

color_blue "→ javac compile rewritten Main.java"
JAVA_FILE="$SAMPLE/src/main/java/com/example/Main.java"
OUT_DIR="$SAMPLE/target/classes"
mkdir -p "$OUT_DIR"

if ! javac -d "$OUT_DIR" "$JAVA_FILE" 2>&1; then
  color_red "FAIL: javac on rewritten Main.java"
  exit 1
fi
color_green "PASS: Java compile"

color_blue "→ runtime smoke (load .env into env, run Main)"
ENV_KV=()
if [ -f "$SAMPLE/.env" ]; then
  while IFS='=' read -r key value; do
    [ -z "$key" ] && continue
    [[ "$key" =~ ^# ]] && continue
    value="${value%\"}"; value="${value#\"}"
    ENV_KV+=("$key=$value")
  done < "$SAMPLE/.env"
fi

OUTPUT=$(env -i PATH="$PATH" "${ENV_KV[@]}" java -cp "$OUT_DIR" com.example.Main 2>&1)
echo "$OUTPUT"
if echo "$OUTPUT" | grep -q "stripe configured: true" && \
   echo "$OUTPUT" | grep -q "github configured: true" && \
   echo "$OUTPUT" | grep -q "aws configured: true"; then
  color_green "PASS: Java runtime smoke (System.getenv resolved)"
else
  color_red "FAIL: Java runtime — env values not resolved"
  exit 1
fi
