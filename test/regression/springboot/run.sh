#!/bin/bash
# Spring Boot regression test
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../_lib.sh"

SAMPLE="$DIR/sample-app"
EXPECTED="$DIR/expected-secrets.json"

echo "═══ Spring Boot Regression ═══"
require_dir "$SAMPLE"

if ! command -v javac >/dev/null 2>&1; then
  color_yellow "[SKIP] javac not found (JDK 필요)"
  exit 0
fi

BACKUP=$(backup_dir "$SAMPLE")
trap "restore_dir '$SAMPLE' '$BACKUP'" EXIT INT TERM

run_blinder_blind "$SAMPLE"
verify_expected "$SAMPLE" "$EXPECTED"

color_blue "→ verify application.properties placeholder rewrite"
PROPS="$SAMPLE/src/main/resources/application.properties"
if grep -q '^spring.datasource.password=ProdSecretP@ssw0rd' "$PROPS"; then
  color_red "FAIL: spring.datasource.password still contains plaintext"
  exit 1
fi
if ! grep -q 'spring.datasource.password=\${' "$PROPS"; then
  color_red "FAIL: spring.datasource.password not rewritten to \${VAR} placeholder"
  cat "$PROPS"
  exit 1
fi
color_green "PASS: application.properties rewritten to \${VAR}"

color_blue "→ confirm system keys (server.port, spring.application.name) untouched"
if ! grep -q '^server.port=8080$' "$PROPS"; then
  color_red "FAIL: server.port mutated"
  exit 1
fi
if ! grep -q '^spring.application.name=blinder-springboot-sample$' "$PROPS"; then
  color_red "FAIL: spring.application.name mutated"
  exit 1
fi
color_green "PASS: system properties left untouched"

color_blue "→ javac compile rewritten SecretsConfig.java"
JAVA_FILE="$SAMPLE/src/main/java/com/example/SecretsConfig.java"
OUT_DIR="$SAMPLE/target/classes"
mkdir -p "$OUT_DIR"

if ! javac -d "$OUT_DIR" "$JAVA_FILE" 2>&1; then
  color_red "FAIL: javac on rewritten SecretsConfig.java"
  exit 1
fi
color_green "PASS: Spring Boot Java compile"

color_blue "→ runtime smoke (load .env, run SecretsConfig)"
ENV_KV=()
if [ -f "$SAMPLE/.env" ]; then
  while IFS='=' read -r key value; do
    [ -z "$key" ] && continue
    [[ "$key" =~ ^# ]] && continue
    # strip surrounding quotes if any
    value="${value%\"}"; value="${value#\"}"
    ENV_KV+=("$key=$value")
  done < "$SAMPLE/.env"
fi

OUTPUT=$(env -i PATH="$PATH" "${ENV_KV[@]}" java -cp "$OUT_DIR" com.example.SecretsConfig 2>&1)
echo "$OUTPUT"
if echo "$OUTPUT" | grep -q "stripe configured: true" && \
   echo "$OUTPUT" | grep -q "github configured: true"; then
  color_green "PASS: Spring Boot runtime smoke (System.getenv resolved)"
else
  color_red "FAIL: Spring Boot runtime — env values not resolved"
  exit 1
fi
