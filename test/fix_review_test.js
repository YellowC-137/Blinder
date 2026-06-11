import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseEnv, cleanGitignore } from '../src/services/rollbackService.js';
import { validateCustomPattern } from '../src/utils/regexGuard.js';
import { performMasking } from '../src/services/maskingService.js';
import { findMaskedDirectory } from '../src/services/restoreService.js';

let pass = 0;
let fail = 0;

function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`✅ ${label}`);
    pass++;
  } else {
    console.log(`❌ ${label}`);
    console.log(`   expected: ${JSON.stringify(expected)}`);
    console.log(`   got:      ${JSON.stringify(actual)}`);
    fail++;
  }
}

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

console.log('🧪 Review Fix Tests\n');

// --- parseEnv: single-char quote values must not collapse to '' ---
const env = parseEnv('A="\nB=\'\nC="hello"\nD=\'\'\nE=""');
expect('parseEnv lone double quote kept as-is', env.A, '"');
expect('parseEnv lone single quote kept as-is', env.B, "'");
expect('parseEnv normal quoted value unwrapped', env.C, 'hello');
expect('parseEnv empty single-quoted pair', env.D, '');
expect('parseEnv empty double-quoted pair', env.E, '');

// --- cleanGitignore: paired END-marker blocks removed, user lines preserved ---
{
  const dir = tmpDir('blinder-gi-');
  const userTail = 'my-own-entry/\n*.custom';
  fs.writeFileSync(path.join(dir, '.gitignore'),
    `node_modules/\n\n# --- BLINDER IOS ---\n\n# iOS\nbuild/\nDerivedData/\n\n# --- BLINDER IOS END ---\n${userTail}\n`);
  const removed = cleanGitignore(dir);
  const after = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
  expect('cleanGitignore paired block removed', removed, true);
  expect('cleanGitignore block markers gone', after.includes('BLINDER'), false);
  expect('cleanGitignore user lines after block preserved', after.includes(userTail), true);
  expect('cleanGitignore user lines before block preserved', after.includes('node_modules/'), true);
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- cleanGitignore: legacy block (no END marker) at EOF still removed ---
{
  const dir = tmpDir('blinder-gi-legacy-');
  fs.writeFileSync(path.join(dir, '.gitignore'),
    'node_modules/\n\n# --- BLINDER COMMON ---\n\n# Blinder\n.env\nsecrets/\n');
  const removed = cleanGitignore(dir);
  const after = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
  expect('cleanGitignore legacy block removed', removed, true);
  expect('cleanGitignore legacy markers gone', after.includes('BLINDER'), false);
  expect('cleanGitignore legacy: preceding user lines kept', after.includes('node_modules/'), true);
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- cleanGitignore: no BLINDER content → untouched, returns false ---
{
  const dir = tmpDir('blinder-gi-none-');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n');
  expect('cleanGitignore returns false without blocks', cleanGitignore(dir), false);
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- regexGuard: RegExp instance without g flag gets g forced ---
{
  const result = validateCustomPattern({ name: 'NoGlobal', regex: /secret-[a-z0-9]{8}/i, severity: 'HIGH' });
  expect('regexGuard accepts non-global RegExp', result.ok, true);
  expect('regexGuard forces g flag', result.ok && result.pattern.regex.global, true);
  expect('regexGuard keeps original flags', result.ok && result.pattern.regex.ignoreCase, true);
}
{
  const result = validateCustomPattern({ name: 'AlreadyGlobal', regex: /token-[a-z]{4}/g, severity: 'LOW' });
  expect('regexGuard passes global RegExp through', result.ok && result.pattern.regex.global, true);
}

// --- performMasking: map written to .blinder_maps/, not inside maskDir ---
{
  const repo = tmpDir('blinder-mask-');
  fs.writeFileSync(path.join(repo, 'app.js'), 'const key = "sk-aaaabbbbccccdddd";');
  const maskDir = path.join(repo, 'maskedProject_demo');
  const results = [{
    file: 'app.js', line: 1, match: 'sk-aaaabbbbccccdddd', fullMatch: 'sk-aaaabbbbccccdddd',
    patternName: 'Generic API Key', envVarName: 'GENERIC_API_KEY', severity: 'HIGH',
    isFixable: true, isTestKey: false, isSensitiveFile: false, isComment: false,
    isMultiline: false, content: '', isLikelyExample: false
  }];
  await performMasking(repo, ['app.js'], results, maskDir);

  const newMapPath = path.join(repo, '.blinder_maps', 'maskedProject_demo.json');
  expect('map written to .blinder_maps/<name>.json', fs.existsSync(newMapPath), true);
  expect('no map inside maskDir', fs.existsSync(path.join(maskDir, '.blinder_map.json')), false);
  const masked = fs.readFileSync(path.join(maskDir, 'app.js'), 'utf8');
  expect('secret masked in copy', masked.includes('__BLINDER_GENERIC_API_KEY__'), true);
  expect('secret absent from copy', masked.includes('sk-aaaabbbbccccdddd'), false);

  // findMaskedDirectory: new layout
  expect('findMaskedDirectory resolves via .blinder_maps', findMaskedDirectory(repo), maskDir);
  fs.rmSync(repo, { recursive: true, force: true });
}

// --- findMaskedDirectory: legacy layout (map inside maskDir) still found ---
{
  const repo = tmpDir('blinder-legacy-');
  const maskDir = path.join(repo, `maskedProject_${path.basename(repo)}`);
  fs.mkdirSync(maskDir, { recursive: true });
  fs.writeFileSync(path.join(maskDir, '.blinder_map.json'), '{}');
  expect('findMaskedDirectory resolves legacy layout', findMaskedDirectory(repo), maskDir);
  fs.rmSync(repo, { recursive: true, force: true });
}

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
