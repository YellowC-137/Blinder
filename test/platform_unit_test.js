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

  // 6. Java
  const java = platforms.find(p => p.id === 'java');
  if (java) {
    function mkTmp3(setup) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blinder-java-'));
      setup(dir);
      return dir;
    }
    function rmTmp3(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

    async function asyncTest3(name, fn) {
      try { await fn(); console.log(`✅ PASS: ${name}`); passCount++; }
      catch (e) { console.error(`❌ FAIL: ${name}\n   ${e.message}`); failCount++; }
    }

    test('Java - .java replacement', () => {
      assert.strictEqual(java.getAutoFixReplacement('s', 'MY_KEY', '.java'), 'System.getenv("MY_KEY")');
    });
    test('Java - .properties replacement', () => {
      assert.strictEqual(java.getAutoFixReplacement('s', 'MY_KEY', '.properties'), '${MY_KEY}');
    });
    test('Java - .xml replacement', () => {
      assert.strictEqual(java.getAutoFixReplacement('s', 'MY_KEY', '.xml'), '${MY_KEY}');
    });

    await asyncTest3('Java detect — pure Maven (match)', async () => {
      const dir = mkTmp3(d => fs.writeFileSync(path.join(d, 'pom.xml'),
        '<project><dependencies><dependency><groupId>org.junit</groupId></dependency></dependencies></project>'));
      try { assert.strictEqual(await java.detect(dir), true); }
      finally { rmTmp3(dir); }
    });

    await asyncTest3('Java detect — Spring Boot pom.xml (NOT java)', async () => {
      const dir = mkTmp3(d => fs.writeFileSync(path.join(d, 'pom.xml'),
        '<project><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></project>'));
      try { assert.strictEqual(await java.detect(dir), false); }
      finally { rmTmp3(dir); }
    });

    await asyncTest3('Java detect — Spring Boot Gradle (NOT java)', async () => {
      const dir = mkTmp3(d => fs.writeFileSync(path.join(d, 'build.gradle'),
        'plugins { id "org.springframework.boot" version "3.0.0" }'));
      try { assert.strictEqual(await java.detect(dir), false); }
      finally { rmTmp3(dir); }
    });

    await asyncTest3('Java detect — Android Gradle (NOT java)', async () => {
      const dir = mkTmp3(d => fs.writeFileSync(path.join(d, 'build.gradle'),
        'apply plugin: "com.android.application"'));
      try { assert.strictEqual(await java.detect(dir), false); }
      finally { rmTmp3(dir); }
    });

    await asyncTest3('Java detect — pure Gradle (match)', async () => {
      const dir = mkTmp3(d => fs.writeFileSync(path.join(d, 'build.gradle'),
        'apply plugin: "java"\ndependencies { implementation "org.apache.commons:commons-lang3:3.12.0" }'));
      try { assert.strictEqual(await java.detect(dir), true); }
      finally { rmTmp3(dir); }
    });

    await asyncTest3('Java detect — Maven src layout only (match)', async () => {
      const dir = mkTmp3(d => fs.mkdirSync(path.join(d, 'src/main/java/com/example'), { recursive: true }));
      try { assert.strictEqual(await java.detect(dir), true); }
      finally { rmTmp3(dir); }
    });

    await asyncTest3('Java detect — empty dir (NOT java)', async () => {
      const dir = mkTmp3(() => {});
      try { assert.strictEqual(await java.detect(dir), false); }
      finally { rmTmp3(dir); }
    });
  }

  // 5. Spring Boot
  const springboot = platforms.find(p => p.id === 'springboot');
  if (springboot) {
    function mkTmp4(setup) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blinder-spring-'));
      setup(dir);
      return dir;
    }
    function rmTmp4(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

    async function asyncTest4(name, fn) {
      try { await fn(); console.log(`✅ PASS: ${name}`); passCount++; }
      catch (e) { console.error(`❌ FAIL: ${name}\n   ${e.message}`); failCount++; }
    }

    test('Spring Boot - .java replacement', () => {
      assert.strictEqual(springboot.getAutoFixReplacement('s', 'DB_PW', '.java'), 'System.getenv("DB_PW")');
    });
    test('Spring Boot - .kt replacement', () => {
      assert.strictEqual(springboot.getAutoFixReplacement('s', 'DB_PW', '.kt'), 'System.getenv("DB_PW")');
    });
    test('Spring Boot - .properties replacement', () => {
      assert.strictEqual(springboot.getAutoFixReplacement('s', 'DB_PW', '.properties'), '${DB_PW}');
    });
    test('Spring Boot - .yml replacement', () => {
      assert.strictEqual(springboot.getAutoFixReplacement('s', 'DB_PW', '.yml'), '${DB_PW}');
    });
    test('Spring Boot - .yaml replacement', () => {
      assert.strictEqual(springboot.getAutoFixReplacement('s', 'DB_PW', '.yaml'), '${DB_PW}');
    });

    await asyncTest4('Spring Boot - applyAdvancedFix rewrites @Value literal', async () => {
      const r = await springboot.applyAdvancedFix({
        lineContent: '    @Value("plain-secret-xyz")',
        match: 'plain-secret-xyz',
        envVarName: 'PLAIN_SECRET_XYZ',
        ext: '.java'
      });
      assert.strictEqual(r.handled, true);
      assert.ok(r.lineContent.includes('@Value("${PLAIN_SECRET_XYZ}")'), `got: ${r.lineContent}`);
    });

    await asyncTest4('Spring Boot - applyAdvancedFix skips existing ${...} placeholder', async () => {
      const r = await springboot.applyAdvancedFix({
        lineContent: '    @Value("${EXISTING_VAR}")',
        match: '${EXISTING_VAR}',
        envVarName: 'X',
        ext: '.java'
      });
      assert.strictEqual(r.handled, false);
    });

    await asyncTest4('Spring Boot - applyAdvancedFix skips non-Java files', async () => {
      const r = await springboot.applyAdvancedFix({
        lineContent: 'spring.datasource.password=plain',
        match: 'plain', envVarName: 'X', ext: '.properties'
      });
      assert.strictEqual(r.handled, false);
    });

    await asyncTest4('Spring Boot detect — pom.xml with spring-boot-starter (match)', async () => {
      const dir = mkTmp4(d => fs.writeFileSync(path.join(d, 'pom.xml'),
        '<project><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></project>'));
      try { assert.strictEqual(await springboot.detect(dir), true); }
      finally { rmTmp4(dir); }
    });

    await asyncTest4('Spring Boot detect — Gradle with org.springframework.boot (match)', async () => {
      const dir = mkTmp4(d => fs.writeFileSync(path.join(d, 'build.gradle'),
        'plugins { id "org.springframework.boot" version "3.0.0" }'));
      try { assert.strictEqual(await springboot.detect(dir), true); }
      finally { rmTmp4(dir); }
    });

    await asyncTest4('Spring Boot detect — pure Maven without spring (NOT spring)', async () => {
      const dir = mkTmp4(d => fs.writeFileSync(path.join(d, 'pom.xml'),
        '<project><dependency><artifactId>commons-lang3</artifactId></dependency></project>'));
      try { assert.strictEqual(await springboot.detect(dir), false); }
      finally { rmTmp4(dir); }
    });

    await asyncTest4('Spring Boot detect — empty dir (NOT spring)', async () => {
      const dir = mkTmp4(() => {});
      try { assert.strictEqual(await springboot.detect(dir), false); }
      finally { rmTmp4(dir); }
    });

    // classifier
    const { classifySpringPropertyKey } = await import('../src/protectors/keyClassifier.js');
    test('Spring classifier - spring.datasource.password ALLOW', () => {
      assert.strictEqual(classifySpringPropertyKey('spring.datasource.password').allowed, true);
    });
    test('Spring classifier - my.app.api-key ALLOW (kebab→dot)', () => {
      assert.strictEqual(classifySpringPropertyKey('my.app.api-key').allowed, true);
    });
    test('Spring classifier - server.port BLOCK', () => {
      assert.strictEqual(classifySpringPropertyKey('server.port').allowed, false);
    });
    test('Spring classifier - spring.application.name BLOCK', () => {
      assert.strictEqual(classifySpringPropertyKey('spring.application.name').allowed, false);
    });
    test('Spring classifier - logging.level.root BLOCK', () => {
      assert.strictEqual(classifySpringPropertyKey('logging.level.root').allowed, false);
    });
    test('Spring classifier - management.endpoints.web BLOCK', () => {
      assert.strictEqual(classifySpringPropertyKey('management.endpoints.web.exposure.include').allowed, false);
    });
    test('Spring classifier - random.user.name DEFAULT DENY', () => {
      assert.strictEqual(classifySpringPropertyKey('random.user.name').allowed, false);
    });
  }

  console.log(`\nUnit Tests Finished: ${passCount} passed, ${failCount} failed.`);
  if (failCount > 0) process.exit(1);
}

runUnitTests().catch(err => {
  console.error(err);
  process.exit(1);
});
