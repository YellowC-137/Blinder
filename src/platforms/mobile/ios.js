import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;

export default {
  id: 'ios',
  name: 'iOS',
  category: 'mobile',

  detect: async (repoPath) => {
    const hasIosDir = fs.existsSync(path.join(repoPath, 'ios'));
    const xcodeProjects = await glob(['**/*.xcodeproj', '**/*.xcworkspace'], { 
      cwd: repoPath, 
      deep: 3,
      ignore: ['**/node_modules/**', '**/Pods/**']
    });
    return hasIosDir || xcodeProjects.length > 0;
  },

  commonExtensions: ['.swift', '.m', '.h', '.pbxproj', '.xcconfig', '.plist'],

  sensitiveFiles: [
    { glob: '**/*-Info.plist', severity: 'CRITICAL', reason: 'Firebase 설정 및 API 키가 포함된 파일' },
    { glob: '**/*.xcconfig', severity: 'HIGH', reason: '서버 주소 및 키 정보가 담긴 환경 설정 파일' },
    { glob: '**/*.mobileprovision', severity: 'HIGH', reason: '앱 배포를 위한 프로비저닝 프로필' },
    { glob: '**/*.p12', severity: 'CRITICAL', reason: '애플 개발자 포털의 인증서가 기재된 파일' },
    { glob: '**/ExportOptions.plist', severity: 'MEDIUM', reason: '엔터프라이즈 배포용 등 배포정보가 포함된 파일' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*)/,

  ignorePaths: ['Pods/**', 'DerivedData/**', 'build/**'],

  getGitignoreTemplate: () => `
# iOS / Xcode
build/
DerivedData/
*.moved-aside
*.pbxuser
*.perspectivev3
xcuserdata/
*.xccheckout
*.xcscmblueprint
*.mode1v3
*.mode2v3
*.perspectivev3
!default.pbxuser
!default.mode1v3
!default.mode2v3
!default.perspectivev3
Pods/
*.ipa
*.dSYM.zip
*.dSYM

# iOS Sensitive Files (보안지침 §2)
GoogleService-Info.plist
*.xcconfig
`,

  getAutoFixReplacement: (originalMatch, envVarName, fileExtension, options) => {
    return `ProcessInfo.processInfo.environment["${envVarName}"] ?? ""`;
  }
};
