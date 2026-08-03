import fs from 'fs';
import os from 'os';
import path from 'path';
import { handleHookInput, SHADOW_DIR, hookMapPath } from '../src/services/hookExec.js';

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

console.log('🧪 hookExec Tests\n');

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'blinder-hook-'));
const SECRET = 'sk_live_ABC123XYZ';
fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
fs.writeFileSync(path.join(repo, 'src/config.js'), `const key = "${SECRET}";\n`);
fs.writeFileSync(path.join(repo, 'src/plain.js'), 'export const x = 1;\n');

const mapFile = hookMapPath(repo);
fs.mkdirSync(path.dirname(mapFile), { recursive: true });
fs.writeFileSync(mapFile, JSON.stringify({
  version: '1.0',
  createdAt: new Date().toISOString(),
  projectRoot: repo,
  maskDir: SHADOW_DIR,
  mappings: {
    STRIPE_KEY: { originalValue: SECRET, redactedTag: '__BLINDER_STRIPE_KEY__', files: ['src/config.js'] }
  },
  fileHashes: {},
  allFiles: []
}, null, 2));

const readInput = (file) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Read',
  cwd: repo,
  tool_input: { file_path: file }
});

// 1) Mapped file → redirected to masked shadow
const decision = handleHookInput(readInput(path.join(repo, 'src/config.js')), repo);
expect('mapped read → allow decision', decision?.hookSpecificOutput?.permissionDecision, 'allow');
const shadowPath = decision?.hookSpecificOutput?.updatedInput?.file_path ?? '';
expect('redirects into shadow dir', shadowPath.includes(`${path.sep}${SHADOW_DIR}${path.sep}`), true);
const shadowContent = fs.readFileSync(shadowPath, 'utf8');
expect('shadow has token', shadowContent.includes('__BLINDER_STRIPE_KEY__'), true);
expect('shadow has no secret', shadowContent.includes(SECRET), false);

// 2) Unmapped file → defer to normal flow
expect('unmapped read → null', handleHookInput(readInput(path.join(repo, 'src/plain.js')), repo), null);

// 3) Outside the project → defer
expect('outside-project read → null', handleHookInput(readInput('/etc/hosts'), repo), null);

// 4) Non-Read tool → defer
expect('non-Read tool → null',
  handleHookInput({ hook_event_name: 'PreToolUse', tool_name: 'Edit', cwd: repo, tool_input: { file_path: path.join(repo, 'src/config.js') } }, repo),
  null);

// 5) Reading the shadow itself → defer (no recursion)
expect('shadow read → null', handleHookInput(readInput(shadowPath), repo), null);

// 6) Stale shadow is regenerated after the source changes
const NEW_SECRET_LINE = `const key = "${SECRET}"; const other = 2;\n`;
fs.writeFileSync(path.join(repo, 'src/config.js'), NEW_SECRET_LINE);
fs.utimesSync(path.join(repo, 'src/config.js'), new Date(), new Date(Date.now() + 5000));
const decision2 = handleHookInput(readInput(path.join(repo, 'src/config.js')), repo);
const shadow2 = fs.readFileSync(decision2.hookSpecificOutput.updatedInput.file_path, 'utf8');
expect('stale shadow regenerated', shadow2.includes('const other = 2;'), true);
expect('regenerated shadow still masked', shadow2.includes(SECRET), false);

// ── Edit/Write reverse substitution ──

const editInput = (file, old_string, new_string) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Edit',
  cwd: repo,
  tool_input: { file_path: file, old_string, new_string }
});
const writeInput = (file, content) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Write',
  cwd: repo,
  tool_input: { file_path: file, content }
});

// 8) Edit with tokens → both strings substituted with the real value
const editDecision = handleHookInput(
  editInput(path.join(repo, 'src/config.js'),
    'const key = "__BLINDER_STRIPE_KEY__";',
    'const key = "__BLINDER_STRIPE_KEY__"; // moved'),
  repo);
expect('edit with tokens → allow', editDecision?.hookSpecificOutput?.permissionDecision, 'allow');
expect('old_string substituted', editDecision?.hookSpecificOutput?.updatedInput?.old_string, `const key = "${SECRET}";`);
expect('new_string substituted', editDecision?.hookSpecificOutput?.updatedInput?.new_string, `const key = "${SECRET}"; // moved`);

// 9) Edit without tokens → defer
expect('edit without tokens → null',
  handleHookInput(editInput(path.join(repo, 'src/config.js'), 'const other = 2;', 'const other = 3;'), repo),
  null);

// 10) Write with token to a NEW file → substituted AND file registered in map,
//     so a later Read of that file is masked (Read→Write→Read must not leak)
const newFile = path.join(repo, 'src/copy.js');
const writeDecision = handleHookInput(writeInput(newFile, 'const k = "__BLINDER_STRIPE_KEY__";\n'), repo);
expect('write with token → allow', writeDecision?.hookSpecificOutput?.permissionDecision, 'allow');
expect('write content substituted', writeDecision?.hookSpecificOutput?.updatedInput?.content, `const k = "${SECRET}";\n`);
fs.writeFileSync(newFile, writeDecision.hookSpecificOutput.updatedInput.content); // simulate the tool executing
const rereadDecision = handleHookInput(readInput(newFile), repo);
expect('re-read of written file → masked', rereadDecision?.hookSpecificOutput?.permissionDecision, 'allow');
const rereadContent = fs.readFileSync(rereadDecision.hookSpecificOutput.updatedInput.file_path, 'utf8');
expect('re-read shadow has no secret', rereadContent.includes(SECRET), false);

// 11) Write with token outside the project → defer (tokens stay placeholders)
expect('outside-project write → null',
  handleHookInput(writeInput('/tmp/elsewhere.js', 'const k = "__BLINDER_STRIPE_KEY__";'), repo),
  null);

// 12) Unknown token only → defer (nothing to substitute)
expect('unknown token → null',
  handleHookInput(writeInput(path.join(repo, 'src/x.js'), 'const k = "__BLINDER_NOPE__";'), repo),
  null);

// 13) Corrupt map → fail closed for Read and token-bearing Edit
fs.writeFileSync(mapFile, '{not json');
expect('corrupt map → read denied',
  handleHookInput(readInput(path.join(repo, 'src/config.js')), repo)?.hookSpecificOutput?.permissionDecision,
  'deny');
expect('corrupt map → edit denied',
  handleHookInput(editInput(path.join(repo, 'src/config.js'), '__BLINDER_STRIPE_KEY__', 'x'), repo)?.hookSpecificOutput?.permissionDecision,
  'deny');

// 14) Parseable-but-wrong-shape maps (torn write) → still fail closed
for (const bad of ['null', '42', '[]', '{}', '{"mappings": null}', '{"mappings": 3}']) {
  fs.writeFileSync(mapFile, bad);
  expect(`malformed map ${bad} → read denied`,
    handleHookInput(readInput(path.join(repo, 'src/config.js')), repo)?.hookSpecificOutput?.permissionDecision,
    'deny');
}

// 15) Map with a null mapping entry → deny (not an uncaught throw / raw read)
fs.writeFileSync(mapFile, '{"mappings": {"X": null}}');
let threw = false;
let decision15;
try {
  decision15 = handleHookInput(readInput(path.join(repo, 'src/config.js')), repo);
} catch { threw = true; }
expect('null mapping entry → no throw', threw, false);
expect('null mapping entry → denied', decision15?.hookSpecificOutput?.permissionDecision, 'deny');

fs.rmSync(repo, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
