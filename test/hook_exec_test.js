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

// 7) Corrupt map → fail closed
fs.writeFileSync(mapFile, '{not json');
expect('corrupt map → deny',
  handleHookInput(readInput(path.join(repo, 'src/config.js')), repo)?.hookSpecificOutput?.permissionDecision,
  'deny');

fs.rmSync(repo, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
