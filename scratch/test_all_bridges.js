
import { setupAndroidBridge } from '../src/utils/androidBridge.js';
import { setupIosBridge } from '../src/utils/iosBridge.js';
import { setupFlutterBridge } from '../src/utils/flutterBridge.js';
import fs from 'fs';
import path from 'path';

async function testBridges() {
  const testRoot = path.resolve('./scratch/bridge_test');
  if (fs.existsSync(testRoot)) fs.rmSync(testRoot, { recursive: true });
  fs.mkdirSync(testRoot, { recursive: true });

  console.log('--- Setting up Dummy Android Project (Groovy) ---');
  const androidAppDir = path.join(testRoot, 'android/app');
  fs.mkdirSync(androidAppDir, { recursive: true });
  fs.writeFileSync(path.join(androidAppDir, 'build.gradle'), 'android {\n    defaultConfig {\n    }\n}\n');
  fs.writeFileSync(path.join(testRoot, '.env'), 'API_KEY=secret_value\nURL=https://example.com\n');
  await setupAndroidBridge(testRoot);
  console.log('Result build.gradle:', fs.readFileSync(path.join(androidAppDir, 'build.gradle'), 'utf8'));

  console.log('\n--- Setting up Dummy Android Project (KTS) ---');
  const ktsTestRoot = path.join(testRoot, 'kts_test');
  const ktsAppDir = path.join(ktsTestRoot, 'app');
  fs.mkdirSync(ktsAppDir, { recursive: true });
  fs.writeFileSync(path.join(ktsAppDir, 'build.gradle.kts'), 'android {\n    defaultConfig {\n    }\n}\n');
  fs.writeFileSync(path.join(ktsTestRoot, '.env'), 'KTS_KEY=kts_value\n');
  await setupAndroidBridge(ktsTestRoot);
  console.log('Result build.gradle.kts:', fs.readFileSync(path.join(ktsAppDir, 'build.gradle.kts'), 'utf8'));

  console.log('\n--- Setting up Dummy iOS Project ---');
  const iosDir = path.join(testRoot, 'ios');
  fs.mkdirSync(iosDir, { recursive: true });
  fs.writeFileSync(path.join(iosDir, 'Info.plist'), '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n</dict>\n</plist>');
  await setupIosBridge(testRoot);
  console.log('Generated blinder-ios-setup.sh exists:', fs.existsSync(path.join(testRoot, 'blinder-ios-setup.sh')));

  console.log('\n--- Setting up Dummy Flutter/IDE Project ---');
  const vscodeDir = path.join(testRoot, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  fs.writeFileSync(path.join(vscodeDir, 'launch.json'), '{\n  "configurations": [\n    {\n      "name": "flutter_app",\n      "type": "dart",\n      "request": "launch",\n      "program": "lib/main.dart",\n      "toolArgs": []\n    }\n  ]\n}');
  await setupFlutterBridge(testRoot);
  console.log('Result launch.json:', fs.readFileSync(path.join(vscodeDir, 'launch.json'), 'utf8'));
}

testBridges().catch(console.error);
