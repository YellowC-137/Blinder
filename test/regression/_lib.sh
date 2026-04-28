#!/bin/bash
# Common helpers for regression test runners.
# Sourced by ios/run.sh, android/run.sh, flutter/run.sh.

set -u

REGRESSION_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLINDER_ROOT="$(cd "$REGRESSION_ROOT/../.." && pwd)"
BLINDER_BIN="$BLINDER_ROOT/bin/blinder.js"

color_red() { printf '\033[31m%s\033[0m\n' "$1"; }
color_green() { printf '\033[32m%s\033[0m\n' "$1"; }
color_yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
color_blue() { printf '\033[34m%s\033[0m\n' "$1"; }

require_dir() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    color_yellow "[SKIP] sample-app 누락: $dir"
    color_yellow "       README.md 참고하여 샘플 프로젝트 추가 필요"
    exit 0
  fi
}

backup_dir() {
  local src="$1"
  local backup="$src.regression-backup.$$"
  cp -r "$src" "$backup"
  echo "$backup"
}

restore_dir() {
  local src="$1"
  local backup="$2"
  rm -rf "$src"
  mv "$backup" "$src"
}

run_blinder_blind() {
  local target="$1"
  color_blue "→ blinder blind --yes (target: $target)"
  (cd "$target" && node "$BLINDER_BIN" blind --yes)
}

run_blinder_restore() {
  local target="$1"
  color_blue "→ blinder restore --yes"
  (cd "$target" && node "$BLINDER_BIN" restore --yes)
}

verify_expected() {
  local target="$1"
  local expected_json="$2"
  if [ ! -f "$expected_json" ]; then
    color_yellow "  expected-secrets.json 없음 — 검증 스킵"
    return 0
  fi
  color_blue "→ expected-secrets.json 비교"
  node -e "
    const fs = require('fs');
    const expected = JSON.parse(fs.readFileSync('$expected_json', 'utf8'));
    const envFile = '$target/.env';
    if (!fs.existsSync(envFile)) {
      console.error('FAIL: .env not generated');
      process.exit(1);
    }
    const envContent = fs.readFileSync(envFile, 'utf8');
    const missing = expected.envVarNames.filter(name => !new RegExp('^' + name + '=', 'm').test(envContent));
    if (missing.length > 0) {
      console.error('FAIL: missing envVarNames in .env:', missing.join(', '));
      process.exit(1);
    }
    console.log('  PASS: all expected envVarNames present');
  "
}
