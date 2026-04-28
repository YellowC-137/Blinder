import { parsePlist, isInfoPlist } from '../src/detectors/parsers/plistParser.js';
import { parseProperties } from '../src/detectors/parsers/propertiesParser.js';
import { parseManifestMetaData, isAndroidManifest } from '../src/detectors/parsers/manifestParser.js';

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

console.log('🧪 Parser Tests\n');

// plist parser
const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>KAKAO_APP_KEY</key>
  <string>abc123def456ghi789</string>
  <key>NMFClientId</key>
  <string>naver_client_xyz</string>
</dict>
</plist>`;

const plistEntries = parsePlist(plistXml);
expect('plist entry count', plistEntries.length, 3);
expect('plist KAKAO_APP_KEY value', plistEntries[1].key, 'KAKAO_APP_KEY');
expect('plist KAKAO_APP_KEY value extracted', plistEntries[1].value, 'abc123def456ghi789');
expect('isInfoPlist Info.plist', isInfoPlist('foo/Info.plist'), true);
expect('isInfoPlist Info-Debug.plist', isInfoPlist('foo/Info-Debug.plist'), true);
expect('isInfoPlist GoogleService-Info.plist', isInfoPlist('GoogleService-Info.plist'), false);

// properties parser
const propsContent = `# comment line
! also comment
org.gradle.jvmargs=-Xmx4g
KAKAO_APP_KEY=abcdef123456
KEYSTORE_PASSWORD=secret\\:value
multiline_key=part1 \\
part2

URL_KEY=https\\://example.com/path`;

const propsEntries = parseProperties(propsContent);
expect('properties count (excluding comments/blank)',
  propsEntries.length, 5);
expect('properties KAKAO key',
  propsEntries.find(e => e.key === 'KAKAO_APP_KEY')?.value, 'abcdef123456');
expect('properties escape \\: handling',
  propsEntries.find(e => e.key === 'KEYSTORE_PASSWORD')?.value, 'secret:value');
expect('properties URL escape',
  propsEntries.find(e => e.key === 'URL_KEY')?.value, 'https://example.com/path');

// manifest parser
const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <meta-data android:name="com.kakao.sdk.AppKey" android:value="abc123" />
    <meta-data
        android:name="com.google.android.geo.API_KEY"
        android:value="AIzaSyExample" />
    <meta-data android:name="android.support.VERSION" android:value="28.0.0"/>
    <meta-data android:name="resource_only" android:resource="@string/foo"/>
  </application>
</manifest>`;

const metaEntries = parseManifestMetaData(manifestXml);
expect('manifest meta-data count', metaEntries.length, 4);
expect('manifest kakao key extracted',
  metaEntries.find(e => e.name === 'com.kakao.sdk.AppKey')?.value, 'abc123');
expect('manifest multiline value extracted',
  metaEntries.find(e => e.name === 'com.google.android.geo.API_KEY')?.value, 'AIzaSyExample');
expect('manifest resource-only entry has null value',
  metaEntries.find(e => e.name === 'resource_only')?.value, null);
expect('isAndroidManifest', isAndroidManifest('app/src/main/AndroidManifest.xml'), true);
expect('isAndroidManifest non-match', isAndroidManifest('app/foo.xml'), false);

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
