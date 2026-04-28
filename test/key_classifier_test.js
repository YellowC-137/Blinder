import { classifyKey } from '../src/protectors/keyClassifier.js';

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

console.log('🧪 keyClassifier Tests\n');

// iOS Info.plist whitelist
expect('plist KAKAO_APP_KEY → allowed',
  classifyKey({ fileType: 'plist', key: 'KAKAO_APP_KEY' }).allowed, true);
expect('plist NMFClientId → allowed',
  classifyKey({ fileType: 'plist', key: 'NMFClientId' }).allowed, true);
expect('plist GIDClientID → allowed',
  classifyKey({ fileType: 'plist', key: 'GIDClientID' }).allowed, true);
expect('plist GMSApiKey → allowed',
  classifyKey({ fileType: 'plist', key: 'GMSApiKey' }).allowed, true);
expect('plist FacebookAppID → allowed',
  classifyKey({ fileType: 'plist', key: 'FacebookAppID' }).allowed, true);

// iOS Info.plist blacklist
expect('plist CFBundleVersion → blocked',
  classifyKey({ fileType: 'plist', key: 'CFBundleVersion' }).allowed, false);
expect('plist NSAppTransportSecurity → blocked',
  classifyKey({ fileType: 'plist', key: 'NSAppTransportSecurity' }).allowed, false);
expect('plist UILaunchStoryboardName → blocked',
  classifyKey({ fileType: 'plist', key: 'UILaunchStoryboardName' }).allowed, false);
expect('plist random unknown key → default deny',
  classifyKey({ fileType: 'plist', key: 'SomeRandomThing' }).allowed, false);

// xcconfig — always blocked (self-reference risk)
expect('xcconfig MY_API_KEY → blocked (auto-fix permanently disabled)',
  classifyKey({ fileType: 'xcconfig', key: 'MY_API_KEY' }).allowed, false);
expect('xcconfig SDKROOT → blocked (system)',
  classifyKey({ fileType: 'xcconfig', key: 'SDKROOT' }).allowed, false);
expect('xcconfig OTHER_LDFLAGS → blocked (prefix)',
  classifyKey({ fileType: 'xcconfig', key: 'OTHER_LDFLAGS' }).allowed, false);

// Android Manifest meta-data
expect('manifest com.kakao.sdk.AppKey → allowed',
  classifyKey({ fileType: 'manifest', key: 'com.kakao.sdk.AppKey' }).allowed, true);
expect('manifest com.google.android.geo.API_KEY → allowed',
  classifyKey({ fileType: 'manifest', key: 'com.google.android.geo.API_KEY' }).allowed, true);
expect('manifest com.google.android.gms.ads.APPLICATION_ID → allowed',
  classifyKey({ fileType: 'manifest', key: 'com.google.android.gms.ads.APPLICATION_ID' }).allowed, true);
expect('manifest android.support.VERSION → blocked',
  classifyKey({ fileType: 'manifest', key: 'android.support.VERSION' }).allowed, false);
expect('manifest com.google.android.gms.version → blocked',
  classifyKey({ fileType: 'manifest', key: 'com.google.android.gms.version' }).allowed, false);
expect('manifest androidx.foo.bar → blocked (prefix)',
  classifyKey({ fileType: 'manifest', key: 'androidx.foo.bar' }).allowed, false);

// Android properties
expect('properties API_KEY in gradle.properties → allowed (key hint)',
  classifyKey({ fileType: 'properties', key: 'MY_API_KEY', filename: 'gradle.properties' }).allowed, true);
expect('properties KEYSTORE_PASSWORD → allowed',
  classifyKey({ fileType: 'properties', key: 'KEYSTORE_PASSWORD', filename: 'gradle.properties' }).allowed, true);
expect('properties org.gradle.jvmargs → blocked (system)',
  classifyKey({ fileType: 'properties', key: 'org.gradle.jvmargs', filename: 'gradle.properties' }).allowed, false);
expect('properties android.useAndroidX → blocked',
  classifyKey({ fileType: 'properties', key: 'android.useAndroidX', filename: 'gradle.properties' }).allowed, false);
expect('properties sdk.dir in local.properties → blocked (file-level)',
  classifyKey({ fileType: 'properties', key: 'sdk.dir', filename: 'local.properties' }).allowed, false);
expect('properties API_KEY in local.properties → blocked (file-level deny)',
  classifyKey({ fileType: 'properties', key: 'API_KEY', filename: 'local.properties' }).allowed, false);

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
