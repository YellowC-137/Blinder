import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectProjectType } from '../src/utils/detector.js';
import { scanProject } from '../src/detectors/scanner.js';
import { protectSecrets } from '../src/commands/protect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(REPO_ROOT, 'SmartCert_TEST');

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.error(`❌ ${label}`); }
}

async function main() {
  console.log('🧪 Blind End-to-End Smoke');

  if (!fs.existsSync(FIXTURE)) {
    console.warn(`⚠️  Fixture missing: ${FIXTURE} — SKIP`);
    console.log('Results: 0 passed, 0 failed (skipped)');
    return;
  }

  const project = await detectProjectType(FIXTURE);
  assert(project && Array.isArray(project.platforms), 'detectProjectType returns platforms');

  const results = await scanProject(FIXTURE, project.platforms, {});
  assert(Array.isArray(results), 'scanProject returns array');
  console.log(`   Found ${results.length} secrets`);

  await protectSecrets(FIXTURE, results, { dryRun: true, mode: 'auto' });
  assert(true, 'protectSecrets dryRun completes without throw');

  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
