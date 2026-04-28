import { platforms } from '../src/platforms/index.js';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Unit tests for platform-specific logic.
 * (보안지침 §5: 각 플랫폼별 치환 규칙 검증)
 */
async function runUnitTests() {
  console.log('🧪 Running Platform Unit Tests...\n');

  let passCount = 0;
  let failCount = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passCount++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   ${e.message}`);
      failCount++;
    }
  }

  // 1. Android
  const android = platforms.find(p => p.id === 'android');
  if (android) {
    test('Android - Kotlin/Java replacement', () => {
      assert.strictEqual(android.getAutoFixReplacement('secret', 'MY_KEY', '.kt'), 'BuildConfig.MY_KEY');
      assert.strictEqual(android.getAutoFixReplacement('secret', 'MY_KEY', '.java'), 'BuildConfig.MY_KEY');
    });
    test('Android - XML replacement', () => {
      assert.strictEqual(android.getAutoFixReplacement('secret', 'MY_KEY', '.xml'), '${MY_KEY}');
    });
    test('Android - Gradle replacement', () => {
      assert.strictEqual(android.getAutoFixReplacement('secret', 'MY_KEY', '.gradle'), "System.getenv('MY_KEY') ?: \"\"");
    });
  }

  // 2. iOS
  const ios = platforms.find(p => p.id === 'ios');
  if (ios) {
    test('iOS - Swift replacement', () => {
      const result = ios.getAutoFixReplacement('secret', 'MY_KEY', '.swift');
      assert.ok(result.includes('InfoDictionaryKey: "MY_KEY"'));
    });
    test('iOS - Objective-C replacement', () => {
      const result = ios.getAutoFixReplacement('secret', 'MY_KEY', '.m');
      assert.ok(result.includes('objectForInfoDictionaryKey:@"MY_KEY"'));
    });
    test('iOS - Plist/xcconfig replacement', () => {
      assert.strictEqual(ios.getAutoFixReplacement('secret', 'MY_KEY', '.plist'), '$(MY_KEY)');
    });
  }

  // 3. Flutter
  const flutter = platforms.find(p => p.id === 'flutter');
  if (flutter) {
    test('Flutter - Dart replacement', () => {
      assert.strictEqual(flutter.getAutoFixReplacement('secret', 'MY_KEY', '.dart'), "String.fromEnvironment('MY_KEY')");
    });
  }

  // 4. Android detect() — guard against false-positives on non-Android Gradle projects
  if (android) {
    function mkTmp(setup) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blinder-detect-'));
      setup(dir);
      return dir;
    }
    function rmTmp(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

    async function asyncTest(name, fn) {
      try { await fn(); console.log(`✅ PASS: ${name}`); passCount++; }
      catch (e) { console.error(`❌ FAIL: ${name}\n   ${e.message}`); failCount++; }
    }

    await asyncTest('Android detect — Spring Boot Gradle (NOT android)', async () => {
      const dir = mkTmp(d => {
        fs.writeFileSync(path.join(d, 'build.gradle'), 'plugins { id "org.springframework.boot" }');
      });
      try { assert.strictEqual(await android.detect(dir), false); }
      finally { rmTmp(dir); }
    });

    await asyncTest('Android detect — pure Maven (NOT android)', async () => {
      const dir = mkTmp(d => fs.writeFileSync(path.join(d, 'pom.xml'), '<project></project>'));
      try { assert.strictEqual(await android.detect(dir), false); }
      finally { rmTmp(dir); }
    });

    await asyncTest('Android detect — native Android (com.android.application)', async () => {
      const dir = mkTmp(d => {
        fs.mkdirSync(path.join(d, 'app'), { recursive: true });
        fs.writeFileSync(path.join(d, 'app/build.gradle'), 'apply plugin: "com.android.application"');
      });
      try { assert.strictEqual(await android.detect(dir), true); }
      finally { rmTmp(dir); }
    });

    await asyncTest('Android detect — Flutter android/ subdir', async () => {
      const dir = mkTmp(d => {
        fs.mkdirSync(path.join(d, 'android/app'), { recursive: true });
        fs.writeFileSync(path.join(d, 'android/app/build.gradle'), 'apply plugin: "com.android.application"');
      });
      try { assert.strictEqual(await android.detect(dir), true); }
      finally { rmTmp(dir); }
    });

    await asyncTest('Android detect — AndroidManifest.xml at root', async () => {
      const dir = mkTmp(d => fs.writeFileSync(path.join(d, 'AndroidManifest.xml'), '<manifest/>'));
      try { assert.strictEqual(await android.detect(dir), true); }
      finally { rmTmp(dir); }
    });

    await asyncTest('Android detect — Kotlin DSL com.android.library', async () => {
      const dir = mkTmp(d => {
        fs.writeFileSync(path.join(d, 'build.gradle.kts'), 'plugins { id("com.android.library") version "8.0.0" }');
      });
      try { assert.strictEqual(await android.detect(dir), true); }
      finally { rmTmp(dir); }
    });
  }

  // 5. Node.js
  const node = platforms.find(p => p.id === 'node');
  if (node) {
    function mkTmp2(setup) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blinder-node-'));
      setup(dir);
      return dir;
    }
    function rmTmp2(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

    async function asyncTest2(name, fn) {
      try { await fn(); console.log(`✅ PASS: ${name}`); passCount++; }
      catch (e) { console.error(`❌ FAIL: ${name}\n   ${e.message}`); failCount++; }
    }

    test('Node.js - JS replacement', () => {
      assert.strictEqual(node.getAutoFixReplacement('secret', 'MY_KEY', '.js'), 'process.env.MY_KEY');
      assert.strictEqual(node.getAutoFixReplacement('secret', 'MY_KEY', '.ts'), 'process.env.MY_KEY');
    });

    await asyncTest2('Node.js detect — Express minimal (match)', async () => {
      const dir = mkTmp2(d => fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({
        name: 't', version: '1.0.0', dependencies: { express: '^4.0.0' }
      })));
      try { assert.strictEqual(await node.detect(dir), true); }
      finally { rmTmp2(dir); }
    });

    await asyncTest2('Node.js detect — React project (NOT node)', async () => {
      const dir = mkTmp2(d => fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({
        name: 't', version: '1.0.0', dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' }
      })));
      try { assert.strictEqual(await node.detect(dir), false); }
      finally { rmTmp2(dir); }
    });

    await asyncTest2('Node.js detect — Next.js (NOT node)', async () => {
      const dir = mkTmp2(d => fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({
        name: 't', version: '1.0.0', dependencies: { next: '^14.0.0' }
      })));
      try { assert.strictEqual(await node.detect(dir), false); }
      finally { rmTmp2(dir); }
    });

    await asyncTest2('Node.js detect — no package.json (NOT node)', async () => {
      const dir = mkTmp2(() => {});
      try { assert.strictEqual(await node.detect(dir), false); }
      finally { rmTmp2(dir); }
    });
  }

  console.log(`\nUnit Tests Finished: ${passCount} passed, ${failCount} failed.`);
  if (failCount > 0) process.exit(1);
}

runUnitTests().catch(err => {
  console.error(err);
  process.exit(1);
});
