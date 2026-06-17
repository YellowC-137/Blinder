// New high-severity detection patterns — false-negative gaps closed in this round.
// Verifies the actual exported `patterns` (not copies) match real secrets and
// reject obvious non-secrets. Run: node --import tsx test/new_patterns_test.js
import { patterns } from '../src/detectors/patterns.js';

let passed = 0;
let failed = 0;

function getPattern(name) {
  const p = patterns.find(p => p.name === name);
  if (!p) throw new Error(`pattern not found: ${name}`);
  return p;
}

// Does `name` pattern match `input` (fresh regex each call to avoid lastIndex state)?
function matches(name, input) {
  const p = getPattern(name);
  const re = new RegExp(p.regex.source, p.regex.flags);
  return re.test(input);
}

function assert(cond, label) {
  if (cond) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.error(`❌ ${label}`); }
}

console.log('🧪 New Pattern Detection');

// ─── JWT ───
const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.dQw4w9WgXcQ_signature_here_xx';
assert(matches('JWT', `const token = "${jwt}"`), 'JWT: detect 3-part token');
assert(matches('JWT', `Authorization: Bearer ${jwt}`), 'JWT: detect bearer token');
assert(!matches('JWT', 'const x = "eyJonly.onepart"'), 'JWT: reject non-JWT eyJ string');

// ─── AWS Session Token (ASIA) ───
assert(matches('AWS Session Token', 'AWS_SESSION = "ASIAJEXAMPLE12345678"'), 'ASIA: detect session token');
assert(!matches('AWS Session Token', 'plain ASIAN text here'), 'ASIA: reject ASIAN word');

// ─── MongoDB Atlas SRV ───
assert(
  matches('Database Connection String', 'mongodb+srv://user:pass@cluster0.ab1cd.mongodb.net/mydb'),
  'mongodb+srv: detect Atlas SRV URI'
);
assert(
  matches('Database Connection String', 'postgresql://admin:secret@db.example.com:5432/app'),
  'DB conn: still detects postgresql (regression guard)'
);

// ─── GCP Service Account JSON ───
assert(
  matches('GCP Service Account JSON', '{ "type": "service_account", "project_id": "my-proj" }'),
  'GCP SA: detect service_account marker'
);
assert(
  !matches('GCP Service Account JSON', '{ "type": "user_account" }'),
  'GCP SA: reject non-service-account type'
);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
