import fs from 'fs';
import path from 'path';
import { setupFlutterBridge } from '../../utils/flutterBridge.js';

export default {
  id: 'flutter',
  name: 'Flutter',
  category: 'mobile',

  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'pubspec.yaml'));
  },

  commonExtensions: ['.dart', '.yaml'],

  sensitiveFiles: [
    { glob: '**/generated_plugin_registrant.dart', severity: 'MEDIUM', reason: '내부 경로가 노출될 수 있는 자동 생성 파일' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*)/,

  ignorePaths: [
    '**/.dart_tool/**', 
    '**/.pub-cache/**', 
    '**/build/**',
    '**/generated_plugin_registrant.dart'
  ],

  getGitignoreTemplate: () => `
# Flutter
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
/build/

# Flutter Generated (보안지침 §2)
**/generated_plugin_registrant.dart
`,

  getAutoFixReplacement: (match, envVarName, ext, options) => {
    if (ext === '.dart') {
        return `String.fromEnvironment('${envVarName}')`;
    }
    return `process.env.${envVarName}`;
  },

  setupBridge: async (repoPath) => {
    await setupFlutterBridge(repoPath);
  },

  teardownBridge: async (repoPath) => {
    // Logic to remove Flutter bridge artifacts
    const wrapperPath = path.join(repoPath, 'f.sh');
    if (fs.existsSync(wrapperPath)) {
        fs.unlinkSync(wrapperPath);
    }
    // Note: launch.json/IntelliJ configs are harder to rollback safely without a parser, 
    // but we can at least remove the wrapper.
  },

  testCases: [
    {
      input: "const apiKey = 'secret';",
      expected: "const apiKey = String.fromEnvironment('API_KEY');",
      ext: '.dart',
      envVarName: 'API_KEY'
    }
  ]
};
