// Regression tests for data-loss fixes (2026-07 code review):
// 1. stale maskDir cleared on re-mask / foreign dir refused
// 3. rollback keeps .env when secrets were not restored into source
// 4. $&/$$ substitution tokens in secret values survive rollback
// (Fix 2 — UTF-16 vs byte offset in scanLargeFile — needs BLINDER_FORCE_AST=1
//  and a >500KB fixture; intentionally not run in the default suite because
//  forcing WASM on Node 24 can SIGSEGV. See scanner.ts charOffset comment.)
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');
const { applyAutoFixes } = await import(path.join(srcRoot, 'services/protectionService.ts'));
const { performMasking } = await import(path.join(srcRoot, 'services/maskingService.ts'));
const { performRollback } = await import(path.join(srcRoot, 'services/rollbackService.ts'));
const { rollbackSecrets } = await import(path.join(srcRoot, 'commands/rollback.ts'));

const tmpProject = () => fs.mkdtempSync(path.join(os.tmpdir(), 'blinder-dlt-'));
let passed = 0;
const ok = (name) => { passed++; console.log(`✅ PASS: ${name}`); };

// Fix 4: replacer function keeps $& / $$ literal
{
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, 'app.js'), 'const key = process.env.MY_KEY;\n');
  fs.writeFileSync(path.join(dir, '.env'), 'MY_KEY=abc$&def$$ghi\n');
  fs.writeFileSync(path.join(dir, '.blinder_protect.json'), JSON.stringify({
    migrations: [{ file: 'app.js', envVarName: 'MY_KEY', accessor: 'process.env.MY_KEY', replacedText: '"abc$&def$$ghi"' }]
  }));
  await performRollback(dir, {});
  assert.strictEqual(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), 'const key = "abc$&def$$ghi";\n');
  ok('rollback preserves $&/$$ in secret values');
}

// Fix 3: .env kept when accessor was edited away (secret not restored)
{
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, 'app.js'), 'const key = somethingElse();\n');
  fs.writeFileSync(path.join(dir, '.env'), 'MY_KEY=supersecret\n');
  fs.writeFileSync(path.join(dir, '.blinder_protect.json'), JSON.stringify({
    migrations: [{ file: 'app.js', envVarName: 'MY_KEY', accessor: 'process.env.MY_KEY' }]
  }));
  await rollbackSecrets(dir, { yes: true });
  assert.ok(fs.existsSync(path.join(dir, '.env')), '.env must survive when secrets were not restored');
  ok('rollback keeps .env when secrets unrestored');
}

// Fix 3 control: clean rollback still deletes .env
{
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, 'app.js'), 'const key = process.env.MY_KEY;\n');
  fs.writeFileSync(path.join(dir, '.env'), 'MY_KEY=supersecret\n');
  fs.writeFileSync(path.join(dir, '.blinder_protect.json'), JSON.stringify({
    migrations: [{ file: 'app.js', envVarName: 'MY_KEY', accessor: 'process.env.MY_KEY', replacedText: '"supersecret"' }]
  }));
  await rollbackSecrets(dir, { yes: true });
  assert.ok(!fs.existsSync(path.join(dir, '.env')), 'clean rollback must still delete .env');
  ok('clean rollback still deletes .env');
}

// Fix 1: stale maskDir cleared on re-mask; foreign dir refused
{
  const dir = tmpProject();
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/a.js'), 'const k = "sk-veryverysecretvalue1234";\n');
  const maskDir = path.join(dir, 'masked');
  const results = [{
    file: 'src/a.js', line: 1, match: 'sk-veryverysecretvalue1234',
    envVarName: 'A_KEY', patternName: 'x', severity: 'HIGH',
    isFixable: true, isTestKey: false, isSensitiveFile: false,
    isComment: false, isMultiline: false, content: '', isLikelyExample: false
  }];
  await performMasking(dir, ['src/a.js'], results, maskDir, {});
  fs.writeFileSync(path.join(maskDir, 'stale.js'), 'const k = "__BLINDER_OLD__";\n');
  await performMasking(dir, ['src/a.js'], results, maskDir, {});
  assert.ok(!fs.existsSync(path.join(maskDir, 'stale.js')), 'stale masked file must be cleared on re-mask');
  ok('re-mask clears stale maskDir');

  const dirB = tmpProject();
  fs.writeFileSync(path.join(dirB, 'a.js'), 'x\n');
  const foreign = path.join(dirB, 'precious');
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, 'user_data.txt'), 'do not delete\n');
  await assert.rejects(() => performMasking(dirB, ['a.js'], [], foreign, {}));
  assert.ok(fs.existsSync(path.join(foreign, 'user_data.txt')), 'foreign dir must be untouched');
  ok('existing non-blinder output dir refused and untouched');

  // Basename collision: map for 'masked' exists, but a DIFFERENT dir named
  // 'masked' (sub/masked) must not be cleared by that map.
  const dirC = tmpProject();
  fs.writeFileSync(path.join(dirC, 'a.js'), 'x\n');
  fs.mkdirSync(path.join(dirC, '.blinder_maps'));
  fs.writeFileSync(path.join(dirC, '.blinder_maps', 'masked.json'), JSON.stringify({ maskDir: 'masked' }));
  const collide = path.join(dirC, 'sub', 'masked');
  fs.mkdirSync(collide, { recursive: true });
  fs.writeFileSync(path.join(collide, 'user_data.txt'), 'do not delete\n');
  await assert.rejects(() => performMasking(dirC, ['a.js'], [], collide, {}));
  assert.ok(fs.existsSync(path.join(collide, 'user_data.txt')), 'same-basename foreign dir must survive');
  ok('basename-collision dir refused (map records its own maskDir)');

  // Legacy layout: map inside maskDir proves ownership → re-mask allowed.
  const dirD = tmpProject();
  fs.writeFileSync(path.join(dirD, 'a.js'), 'x\n');
  const legacy = path.join(dirD, 'oldmasked');
  fs.mkdirSync(legacy);
  fs.writeFileSync(path.join(legacy, '.blinder_map.json'), '{}');
  fs.writeFileSync(path.join(legacy, 'stale.js'), 'old\n');
  await performMasking(dirD, ['a.js'], [], legacy, {});
  assert.ok(!fs.existsSync(path.join(legacy, 'stale.js')), 'legacy blinder maskDir must be cleared, not refused');
  ok('legacy in-dir map accepted on re-mask');
}

// Rollback with missing metadata: skipReasons are all 0 but nothing was
// restored — .env must survive.
{
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, '.env'), 'MY_KEY=supersecret\n');
  await rollbackSecrets(dir, { yes: true });
  assert.ok(fs.existsSync(path.join(dir, '.env')), '.env must survive when no metadata / nothing restored');
  ok('rollback without metadata keeps .env');
}

// Partial rollback keeps .blinder_protect.json alongside .env so a retry is
// possible after the accessor is fixed.
{
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, 'app.js'), 'const key = somethingElse();\n');
  fs.writeFileSync(path.join(dir, '.env'), 'MY_KEY=supersecret\n');
  fs.writeFileSync(path.join(dir, '.blinder_protect.json'), JSON.stringify({
    migrations: [{ file: 'app.js', envVarName: 'MY_KEY', accessor: 'process.env.MY_KEY' }]
  }));
  await rollbackSecrets(dir, { yes: true });
  assert.ok(fs.existsSync(path.join(dir, '.blinder_protect.json')), 'metadata must survive partial rollback');
  // Retry after restoring the accessor must now succeed end-to-end.
  fs.writeFileSync(path.join(dir, 'app.js'), 'const key = process.env.MY_KEY;\n');
  await rollbackSecrets(dir, { yes: true });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), 'const key = "supersecret";\n');
  assert.ok(!fs.existsSync(path.join(dir, '.env')), 'clean retry deletes .env');
  assert.ok(!fs.existsSync(path.join(dir, '.blinder_protect.json')), 'clean retry deletes metadata');
  ok('partial rollback keeps metadata; retry completes');
}

// Fix 5: same secret twice on one line — one migration per occurrence,
// so rollback's per-entry single replace restores both.
{
  const dir = tmpProject();
  const orig = 'const a = "sk_dup_secret_9876543210"; const b = "sk_dup_secret_9876543210";\n';
  fs.writeFileSync(path.join(dir, 'app.js'), orig);
  const migrations = await applyAutoFixes(dir, [{
    file: 'app.js', line: 1, match: 'sk_dup_secret_9876543210', envVarName: 'MY_KEY',
    isFixable: true, isSensitiveFile: false, severity: 'HIGH', patternName: 'x',
    fullMatch: '"sk_dup_secret_9876543210"', content: '', isTestKey: false,
    isComment: false, isMultiline: false, isLikelyExample: false
  }], { platforms: [] });
  assert.ok(!fs.readFileSync(path.join(dir, 'app.js'), 'utf8').includes('sk_dup_secret'));
  assert.strictEqual(migrations.length, 2, 'one migration per occurrence');
  fs.writeFileSync(path.join(dir, '.blinder_protect.json'), JSON.stringify({ migrations }));
  fs.writeFileSync(path.join(dir, '.env'), 'MY_KEY=sk_dup_secret_9876543210\n');
  const report = await performRollback(dir, {});
  assert.strictEqual(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), orig);
  assert.strictEqual(report.skipCount, 0);
  ok('duplicate-in-line secret round-trips through protect → rollback');
}

console.log(`\nData-loss regression tests: ${passed} passed.`);
