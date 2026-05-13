import { protectSecrets } from '../src/commands/protect.js';
import { rollbackSecrets } from '../src/commands/rollback.js';
import { scanProject } from '../src/detectors/scanner.js';
import { platforms } from '../src/platforms/index.js';
import fs from 'fs';
import path from 'path';

async function sideEffectTest() {
  console.log('--- Side Effect Test: Obj-C Macro Rollback ---');
  const testDir = path.resolve('./test_side_effect');
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  fs.mkdirSync(testDir);

  const fileM = path.join(testDir, 'Config.m');
  const originalM = 'NSString *const API_KEY = @"SECRET_KEY_123";\n';
  fs.writeFileSync(fileM, originalM);

  // 1. Blind (Protect)
  const iosPlatforms = platforms.filter(p => p.id === 'ios' || p.id === 'common');
  const results = await scanProject(testDir, iosPlatforms);
  await protectSecrets(testDir, results, { mode: 'auto', platforms: iosPlatforms });

  const protectedContent = fs.readFileSync(fileM, 'utf8');
  console.log('Protected Content:', protectedContent.trim());
  if (!protectedContent.includes('((NSString *)')) {
      throw new Error('Casting was not applied correctly in macro');
  }

  // 2. Rollback
  // Need to provide env for rollback
  fs.writeFileSync(path.join(testDir, '.env'), 'API_KEY=SECRET_KEY_123\n');
  await rollbackSecrets(testDir, { yes: true });

  const rolledBackContent = fs.readFileSync(fileM, 'utf8');
  console.log('Rolled Back Content:', rolledBackContent.trim());

  if (rolledBackContent === originalM) {
      console.log('✅ Rollback successful for new macro format!');
  } else {
      console.error('❌ Rollback FAILED! Content mismatch.');
      console.log('Expected:', JSON.stringify(originalM));
      console.log('Actual:', JSON.stringify(rolledBackContent));
      process.exit(1);
  }

  // 3. Android Sanity (Ensure no parentheses added to Java)
  console.log('\n--- Side Effect Test: Android Sanity ---');
  const fileJava = path.join(testDir, 'Config.java');
  const originalJava = 'public String key = "API_KEY_789";\n';
  fs.writeFileSync(fileJava, originalJava);

  const androidPlatforms = platforms.filter(p => p.id === 'android' || p.id === 'common');
  const resultsJava = await scanProject(testDir, androidPlatforms);
  await protectSecrets(testDir, resultsJava, { mode: 'auto', platforms: androidPlatforms });

  const protectedJava = fs.readFileSync(fileJava, 'utf8');
  console.log('Protected Java:', protectedJava.trim());
  if (protectedJava.includes('((')) {
      throw new Error('Parentheses side effect leaked to Android/Java!');
  }
  console.log('✅ Android remains unaffected by Obj-C fix.');

  // Cleanup
  fs.rmSync(testDir, { recursive: true });
  console.log('\n--- ALL SIDE EFFECT TESTS PASSED! 🎉 ---');
}

sideEffectTest().catch(console.error);
