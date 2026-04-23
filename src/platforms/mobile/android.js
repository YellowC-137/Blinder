import fs from 'fs';
import path from 'path';
import { setupAndroidBridge } from '../../utils/androidBridge.js';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'android',
  name: 'Android',
  category: 'mobile',

  detect: async (repoPath) => {
    const hasAndroidDir = fs.existsSync(path.join(repoPath, 'android'));
    const hasBuildGradle = fs.existsSync(path.join(repoPath, 'build.gradle')) || 
                           fs.existsSync(path.join(repoPath, 'app/build.gradle'));
    return hasAndroidDir || hasBuildGradle;
  },

  commonExtensions: ['.kt', '.java', '.xml', '.gradle', '.properties', '.json'],

  sensitiveFiles: [
    { glob: '**/google-services.json', severity: 'CRITICAL', reason: 'Google 서비스 인증 정보가 포함된 파일' },
    { glob: '**/local.properties', severity: 'HIGH', reason: 'SDK 경로 및 API Key가 저장될 수 있는 파일' },
    { glob: '**/gradle.properties', severity: 'HIGH', reason: 'API Key, KeyStore 비밀번호가 저장될 수 있는 파일' },
    { glob: '**/*.jks', severity: 'CRITICAL', reason: '앱 서명 키 파일 (유출 시 치명적)' },
    { glob: '**/*.keystore', severity: 'CRITICAL', reason: '앱 서명 키 파일 (유출 시 치명적)' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*|#)/,

  ignorePaths: [
    '**/.gradle/**', 
    '**/build/**', 
    '**/captures/**', 
    '**/.externalNativeBuild/**',
    '**/google-services.json'
  ],

  getGitignoreTemplate: () => `
# Android
.gradle/
build/
local.properties
gradle.properties
*.apk
*.aab
*.keystore
*.jks
captures/
.externalNativeBuild
.cxx

# Android Sensitive Files (보안지침 §2)
google-services.json
`,

  getAutoFixReplacement: (match, envVarName, ext, options) => {
    if (ext === '.kt' || ext === '.java') {
        return `BuildConfig.${envVarName}`;
    }
    if (ext === '.gradle') {
        return `System.getenv('${envVarName}') ?: ""`;
    }
    if (ext === '.xml') {
        return `\${${envVarName}}`;
    }
    return `process.env.${envVarName}`;
  },

  setupBridge: async (repoPath) => {
    await setupAndroidBridge(repoPath);
  },

  teardownBridge: async (repoPath) => {
    // Logic to remove Gradle bridge
    const gradleFiles = [
        path.join(repoPath, 'app/build.gradle'),
        path.join(repoPath, 'app/build.gradle.kts'),
        path.join(repoPath, 'android/app/build.gradle'),
        path.join(repoPath, 'android/app/build.gradle.kts')
    ];

    for (const absPath of gradleFiles) {
        if (fs.existsSync(absPath)) {
            let content = fs.readFileSync(absPath, 'utf8');
            const startMarker = '// [Blinder Start]';
            const endMarker = '// [Blinder End]';
            const startIndex = content.indexOf(startMarker);
            const endIndex = content.indexOf(endMarker);

            if (startIndex !== -1 && endIndex !== -1) {
                content = content.substring(0, startIndex) + content.substring(endIndex + endMarker.length);
                // Also remove the call
                content = content.replace(/\s*loadDotenv\(\)/g, '');
                fs.writeFileSync(absPath, content);
            }
        }
    }
  },

  testCases: [
    {
      input: 'String apiKey = "secret";',
      expected: 'String apiKey = BuildConfig.API_KEY;',
      ext: '.java',
      envVarName: 'API_KEY'
    }
  ]
});
