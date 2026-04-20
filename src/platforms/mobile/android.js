import fs from 'fs';
import path from 'path';

export default {
  id: 'android',
  name: 'Android',
  category: 'mobile',

  detect: async (repoPath) => {
    const hasAndroidDir = fs.existsSync(path.join(repoPath, 'android'));
    const hasBuildGradle = fs.existsSync(path.join(repoPath, 'build.gradle')) || 
                           fs.existsSync(path.join(repoPath, 'app/build.gradle'));
    return hasAndroidDir || hasBuildGradle;
  },

  commonExtensions: ['.java', '.kt', '.gradle', '.xml', '.properties'],

  sensitiveFiles: [
    { glob: '**/google-services.json', severity: 'CRITICAL', reason: 'Google 서비스 인증 정보가 포함된 파일' },
    { glob: '**/local.properties', severity: 'HIGH', reason: 'SDK 경로 및 API Key가 저장될 수 있는 파일' },
    { glob: '**/gradle.properties', severity: 'HIGH', reason: 'API Key, KeyStore 비밀번호가 저장될 수 있는 파일' },
    { glob: '**/*.jks', severity: 'CRITICAL', reason: '배포를 위한 안드로이드 앱 서명 키스토어' },
    { glob: '**/*.keystore', severity: 'CRITICAL', reason: '배포를 위한 안드로이드 앱 서명 키스토어' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*)/,

  ignorePaths: ['.gradle/**', 'build/**', 'captures/**', '.externalNativeBuild/**'],

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

  getAutoFixReplacement: (originalMatch, envVarName, fileExtension, options) => {
    return `BuildConfig.${envVarName}`;
  }
};
