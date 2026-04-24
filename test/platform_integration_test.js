import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { scanProject } from '../src/detectors/scanner.js';
import { protectSecrets } from '../src/commands/protect.js';
import { rollbackSecrets } from '../src/commands/rollback.js';
import { platforms } from '../src/platforms/index.js';

/**
 * Integration tests for Cross-Platform workflows.
 * Simulates real-world projects and verifies Blinder's behavior.
 */
async function runIntegrationTests() {
  console.log('🚀 Running Platform Integration Tests...\n');

  const testDir = path.resolve('./test_integration_workspace');
  if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  // --- Setup Mock Projects ---
  
  // 1. Android Mock
  const androidFile = path.join(testDir, 'MainActivity.kt');
  fs.writeFileSync(androidFile, 'val API_KEY = "android_secret_1234567890"\n');
  
  // 2. iOS Mock
  const iosFile = path.join(testDir, 'AppDelegate.swift');
  const iosPlist = path.join(testDir, 'Info.plist');
  fs.writeFileSync(iosFile, 'let secret = "ios_secret_4567890123456789"\n');
  fs.writeFileSync(iosPlist, '<?xml version="1.0" encoding="UTF-8"?>\n<dict>\n</dict>\n');

  // 3. Flutter Mock
  const flutterFile = path.join(testDir, 'main.dart');
  fs.writeFileSync(flutterFile, 'const key = "flutter_secret_78901234567890";\n');

  console.log('Mock projects created. Starting scan...');

  // --- Step 1: Scan ---
  const results = await scanProject(testDir, platforms);
  console.log(`Scan found ${results.length} secrets.`);
  assert.strictEqual(results.length, 3, 'Should find 3 secrets (Android, iOS, Flutter)');

  // --- Step 2: Protect (Auto-fix) ---
  console.log('Applying auto-fix...');
  // Mock inquirer/confirm logic is handled inside protectSecrets by passing mode: 'auto'
  await protectSecrets(testDir, results, { 
    mode: 'auto', 
    dryRun: false,
    platforms: platforms
  });

  // --- Step 3: Verify Results ---
  console.log('Verifying files...');

  // Android check
  const androidContent = fs.readFileSync(androidFile, 'utf8');
  assert.ok(androidContent.includes('BuildConfig.'), 'Android file should use BuildConfig');

  // iOS check
  const iosContent = fs.readFileSync(iosFile, 'utf8');
  const iosPlistContent = fs.readFileSync(iosPlist, 'utf8');
  assert.ok(iosContent.includes('Bundle.main.object'), 'iOS file should use Bundle.main');
  assert.ok(iosPlistContent.includes('<key>'), 'Info.plist should have new keys injected');

  // Flutter check
  const flutterContent = fs.readFileSync(flutterFile, 'utf8');
  assert.ok(flutterContent.includes('String.fromEnvironment'), 'Flutter file should use String.fromEnvironment');

  // .env check
  const envContent = fs.readFileSync(path.join(testDir, '.env'), 'utf8');
  assert.ok(envContent.includes('android_secret_123'), '.env should contain Android secret');
  assert.ok(envContent.includes('ios_secret_456'), '.env should contain iOS secret');
  assert.ok(envContent.includes('flutter_secret_789'), '.env should contain Flutter secret');

  console.log('✅ Integration check passed!');

  // --- Step 4: Rollback ---
  console.log('Testing rollback...');
  await rollbackSecrets(testDir, { yes: true, dryRun: false, platforms: platforms });

  assert.ok(fs.readFileSync(androidFile, 'utf8').includes('android_secret_123'), 'Android rollback failed');
  assert.ok(fs.readFileSync(iosFile, 'utf8').includes('ios_secret_456'), 'iOS rollback failed');
  assert.ok(fs.readFileSync(flutterFile, 'utf8').includes('flutter_secret_789'), 'Flutter rollback failed');
  assert.ok(!fs.existsSync(path.join(testDir, '.env')), '.env should be deleted after rollback');

  console.log('✅ Rollback check passed!');

  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\nIntegration Tests Finished: ALL OK! 🎉');
}

runIntegrationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
