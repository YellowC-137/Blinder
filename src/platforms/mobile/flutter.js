import fs from 'fs';
import path from 'path';
import { setupFlutterBridge } from '../../utils/flutterBridge.js';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
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
    // 1. Remove Flutter CLI wrapper
    const wrapperPath = path.join(repoPath, 'f.sh');
    if (fs.existsSync(wrapperPath)) {
        fs.unlinkSync(wrapperPath);
    }

    // 2. Remove IDE launch configs
    const defineArg = '--dart-define-from-file=.env';
    
    // VS Code
    const launchJsonPath = path.join(repoPath, '.vscode', 'launch.json');
    if (fs.existsSync(launchJsonPath)) {
        try {
            let content = fs.readFileSync(launchJsonPath, 'utf8');
            if (content.includes(defineArg)) {
                content = content.replace(new RegExp(`"${defineArg}",\\s*`, 'g'), '');
                content = content.replace(new RegExp(`,\\s*"${defineArg}"`, 'g'), '');
                content = content.replace(new RegExp(`"${defineArg}"`, 'g'), '');
                fs.writeFileSync(launchJsonPath, content);
            }
        } catch (err) {}
    }

    // IntelliJ / Android Studio
    const ideaDir = path.join(repoPath, '.idea', 'runConfigurations');
    if (fs.existsSync(ideaDir)) {
        const files = fs.readdirSync(ideaDir).filter(f => f.endsWith('.xml'));
        for (const file of files) {
            const absPath = path.join(ideaDir, file);
            let content = fs.readFileSync(absPath, 'utf8');
            if (content.includes(defineArg)) {
                content = content.replace(new RegExp(`\\s*${defineArg}`, 'g'), '');
                fs.writeFileSync(absPath, content);
            }
        }
    }
  },

  testCases: [
    {
      input: "const apiKey = 'secret';",
      expected: "const apiKey = String.fromEnvironment('API_KEY');",
      ext: '.dart',
      envVarName: 'API_KEY'
    }
  ]
});
