import { platforms } from '../src/platforms/index.js';
import assert from 'assert';

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

  console.log(`\nUnit Tests Finished: ${passCount} passed, ${failCount} failed.`);
  if (failCount > 0) process.exit(1);
}

runUnitTests().catch(err => {
  console.error(err);
  process.exit(1);
});
