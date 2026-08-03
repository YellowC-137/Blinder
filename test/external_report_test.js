import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseExternalReport } from '../src/detectors/externalReport.js';

let pass = 0;
let fail = 0;

function expect(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    console.log(`✅ ${label}`);
    pass++;
  } else {
    console.log(`❌ ${label}`);
    console.log(`   expected: ${expected}, got: ${actual}`);
    fail++;
  }
}

console.log('🧪 externalReport Tests\n');

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'blinder-ext-'));
const SECRET = 'sk_live_51Nabcdefghijklmnop1234567890';
const API_KEY = 'AIzaSyD9xK2mP3rT4uV5wX6yZ7aB8cD9eF0gH1i';
fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
fs.writeFileSync(path.join(repo, 'src/config.js'),
  `// config\nconst stripe = "${SECRET}";\nconst api = "${API_KEY}";\n`);

// ── Gitleaks JSON array ──
const gitleaksReport = path.join(repo, 'gitleaks.json');
fs.writeFileSync(gitleaksReport, JSON.stringify([
  { RuleID: 'stripe-access-token', File: 'src/config.js', StartLine: 2, Secret: SECRET },
  { RuleID: 'gcp-api-key', File: 'src/config.js', StartLine: 99, Secret: API_KEY }, // wrong line → relocated
  { RuleID: 'stripe-access-token', File: 'src/config.js', StartLine: 2, Secret: SECRET }, // duplicate
  { RuleID: 'aws-access-token', File: 'src/gone.js', StartLine: 1, Secret: 'AKIAAAAAAAAAAAAAAAAA' }, // missing file
  { RuleID: 'stale-key', File: 'src/config.js', StartLine: 1, Secret: 'no_longer_here' } // stale secret
]));

const gl = parseExternalReport(repo, gitleaksReport);
expect('gitleaks: stale/missing/dup filtered → 2 results', gl.length, 2);
expect('gitleaks: secret mapped', gl[0].match, SECRET);
expect('gitleaks: reported line kept', gl[0].line, 2);
expect('gitleaks: wrong line relocated', gl[1].line, 3);
expect('gitleaks: env name from RuleID', gl[0].envVarName, 'STRIPE_ACCESS_TOKEN');
expect('gitleaks: pattern tagged external', gl[0].patternName, 'external:stripe-access-token');
expect('gitleaks: fixable', gl[0].isFixable, true);

// ── TruffleHog NDJSON ──
const trufflehogReport = path.join(repo, 'trufflehog.ndjson');
fs.writeFileSync(trufflehogReport, [
  JSON.stringify({ DetectorName: 'Stripe', Raw: SECRET, SourceMetadata: { Data: { Filesystem: { file: path.join(repo, 'src/config.js'), line: 2 } } } }),
  JSON.stringify({ DetectorName: 'GitHub', Raw: 'ghp_tok', SourceMetadata: { Data: { Git: { commit: 'abc' } } } }), // non-filesystem → skipped
  'not json at all'
].join('\n'));

const th = parseExternalReport(repo, trufflehogReport);
expect('trufflehog: 1 filesystem result', th.length, 1);
expect('trufflehog: absolute path relativized', th[0].file, 'src/config.js');
expect('trufflehog: env name from DetectorName', th[0].envVarName, 'STRIPE');

// ── Multiline secret → reported but not auto-fixable ──
const PEM = '-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----';
fs.writeFileSync(path.join(repo, 'src/key.js'), `const pem = \`${PEM}\`;\n`);
const pemReport = path.join(repo, 'pem.json');
fs.writeFileSync(pemReport, JSON.stringify([
  { RuleID: 'private-key', File: 'src/key.js', StartLine: 1, Secret: PEM }
]));
const pem = parseExternalReport(repo, pemReport);
expect('multiline: reported', pem.length, 1);
expect('multiline: not auto-fixable', pem[0].isFixable, false);
expect('multiline: flagged', pem[0].isMultiline, true);

fs.rmSync(repo, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
