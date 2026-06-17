// Regression: secretValue derivation must NOT truncate base64/colon secrets.
// Earlier code split match on `=`/`:` and kept the last part, corrupting the
// value written to .env (AWS secret keys / crypto salt ending in `=`,
// passwords containing `:`). Run: node --import tsx test/secret_value_test.js
import { deriveEnvSecretValue } from '../src/commands/protect.js';

let passed = 0;
let failed = 0;

function eq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.error(`❌ ${label}\n   expected: ${expected}\n   actual:   ${actual}`); }
}

console.log('🧪 secretValue derivation');

// scanner already isolates the bare value — derivation returns it verbatim.
eq(deriveEnvSecretValue('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY='),
   'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY=',
   'AWS-style base64 with trailing = preserved');
eq(deriveEnvSecretValue('YWJjZGVmZ2hpamtsbW5vcA=='),
   'YWJjZGVmZ2hpamtsbW5vcA==',
   'base64 salt with == padding preserved');
eq(deriveEnvSecretValue('p@ss:w0rd:x'),
   'p@ss:w0rd:x',
   'password containing colons preserved');
eq(deriveEnvSecretValue('AKIAIOSFODNN7EXAMPLE'),
   'AKIAIOSFODNN7EXAMPLE',
   'plain key unchanged');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
