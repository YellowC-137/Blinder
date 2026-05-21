import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;
import { setupIosBridge } from '../../utils/iosBridge.js';
import { definePlatform } from '../definePlatform.js';
import type { AdvancedFixContext, AdvancedFixResult, PostFixContext } from '../types.js';

export default definePlatform({
  id: 'ios',
  name: 'iOS',
  category: 'mobile',
  astLanguage: 'swift',

  detect: async (repoPath: string): Promise<boolean> => {
    const hasIosDir = fs.existsSync(path.join(repoPath, 'ios'));
    const xcodeProjects = await glob(['**/*.xcodeproj', '**/*.xcworkspace'], { 
      cwd: repoPath, 
      deep: 5,
      ignore: ['**/node_modules/**', '**/Pods/**', '**/Carthage/**', '**/DerivedData/**']
    });

    const hasIosFiles = (await glob(['**/*.{swift,m,h,mm,plist}'], {
      cwd: repoPath,
      deep: 3,
      ignore: ['**/node_modules/**', '**/Pods/**']
    })).length > 0;

    return hasIosDir || xcodeProjects.length > 0 || hasIosFiles;
  },

  commonExtensions: ['.swift', '.m', '.h', '.mm', '.plist', '.xcconfig'],

  sensitiveFiles: [
    { glob: '**/GoogleService-Info.plist', severity: 'CRITICAL', reason: 'Firebase 설정 및 API 키가 포함된 파일' },
    { glob: '**/*.xcconfig', severity: 'HIGH', reason: '서버 주소 및 키 정보가 담긴 환경 설정 파일' },
    { glob: '**/*.mobileprovision', severity: 'HIGH', reason: 'iOS 프로비저닝 프로필 (앱 배포 및 권한 정보)' },
    { glob: '**/*.provisionprofile', severity: 'HIGH', reason: 'iOS 프로비저닝 프로필 (앱 배포 및 권한 정보)' },
    { glob: '**/*.entitlements', severity: 'MEDIUM', reason: 'iOS 앱 권한 및 Keychain Access Group 정보' },
    { glob: '**/*.p12', severity: 'CRITICAL', reason: '인증서 및 개인키가 포함된 보안 파일 (유출 시 위험)' },
    { glob: '**/*.pfx', severity: 'CRITICAL', reason: '인증서 및 개인키가 포함된 보안 파일 (유출 시 위험)' },
    { glob: '**/*.cer', severity: 'HIGH', reason: 'iOS 인증서 파일' },
    { glob: '**/*.certSigningRequest', severity: 'MEDIUM', reason: '인증서 서명 요청 (CSR)' },
    { glob: '**/AuthKey_*.p8', severity: 'CRITICAL', reason: 'App Store Connect API 키 (.p8)' },
    { glob: '**/Fastfile', severity: 'MEDIUM', reason: 'Fastlane 설정 (배포 자격증명 참조 가능)' },
    { glob: '**/Appfile', severity: 'MEDIUM', reason: 'Fastlane Apple ID/Team ID 정보' },
    { glob: '**/Matchfile', severity: 'HIGH', reason: 'Fastlane Match 인증서 저장소 정보' },
    { glob: '**/ExportOptions.plist', severity: 'MEDIUM', reason: 'IPA 익스포트 옵션 (팀/프로비저닝 정보)' },
    { glob: '**/Generated.xcconfig', severity: 'LOW', reason: 'Flutter 자동생성 (로컬 경로 노출)' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*)/,

  ignorePaths: [
    '**/Pods/**',
    '**/Carthage/**',
    '**/.build/**',
    '**/.swiftpm/**',
    '**/*.xcframework/**',
    '**/*.framework/**',
    '**/DerivedData/**',
    '**/Package.swift',
    '**/Project.swift',
    '**/Dependencies.swift',
    '**/Workspace.swift',
    '**/Podfile',
    '**/Cartfile',
    '**/*.pbxproj',
    '**/GoogleService-Info.plist'
  ],

  getGitignoreTemplate: (): string => `
# iOS / Xcode
build/
DerivedData/
*.moved-aside
*.pbxuser
*.perspectivev3
userdata/
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

  getAutoFixReplacement: (match: string, envVarName: string, ext: string, options?: Record<string, unknown>): string => {
    if (ext === '.plist' || ext === '.xcconfig') {
      return `$(${envVarName})`;
    }
    // Default Swift/ObjC accessor
    if (ext === '.swift') {
        return `(Bundle.main.object(forInfoDictionaryKey: "${envVarName}") as? String ?? "")`;
    }
    if (ext === '.m' || ext === '.mm' || ext === '.h') {
        return `[[NSBundle mainBundle] objectForInfoDictionaryKey:@"${envVarName}"]`;
    }
    return `process.env.${envVarName}`;
  },

  /**
   * Lifecycle Hook: applyAdvancedFix
   * Handles complex Objective-C constant/macro replacements
   */
  applyAdvancedFix: (context: AdvancedFixContext): Promise<AdvancedFixResult> => {
    const { lineContent, match, envVarName, ext, repoPath, relPath, options, migrations, logger } = context;
    
    const isObjcFile = ext === '.m' || ext === '.h' || ext === '.mm';
    if (!isObjcFile) return Promise.resolve({ handled: false });

    const objcConstRegex = /(?:NSString\s*\*\s*const|const\s+NSString\s*\*)\s+([a-zA-Z0-9_]+)\s*=\s*@?["'][^"']+["']\s*;/i;
    const objcConstMatch = lineContent.match(objcConstRegex);

    if (objcConstMatch) {
      const varName = objcConstMatch[1];
      const hFileName = relPath.replace(/\.m(m|)$/, '.h');
      const hAbsPath = path.join(repoPath, hFileName);
      
      let headerExternFound = false;

      // Strategy A: Synchronize with Header (Public Constant)
      if (fs.existsSync(hAbsPath)) {
        let hContent = fs.readFileSync(hAbsPath, 'utf8');
        const externRegex = new RegExp(`extern\\s+NSString\\s*\\*\\s*const\\s+${varName}\\s*;`, 'i');
        const externMatch = hContent.match(externRegex);
        
        if (externMatch) {
          headerExternFound = true;
          const macro = `#define ${varName} ((NSString *)[[NSBundle mainBundle] objectForInfoDictionaryKey:@"${envVarName}"])`;
          const headerReplacedText = externMatch[0];
          
          if (!options.dryRun) {
            hContent = hContent.replace(externRegex, macro);
            fs.writeFileSync(hAbsPath, hContent);
          }

          migrations.push({
            file: hFileName,
            envVarName: envVarName,
            accessor: macro,
            injectedText: macro,
            replacedText: headerReplacedText
          });
        }
      }

      if (headerExternFound) {
        const placeholder = `// Protected by Blinder: ${varName} moved to macro in header`;
        return Promise.resolve({
          handled: true,
          lineContent: placeholder,
          injectedText: placeholder,
          replacedText: lineContent
        });
      } else {
        // Strategy B: Inline replacement (Private/Internal Constant)
        const macro = `#define ${varName} ((NSString *)[[NSBundle mainBundle] objectForInfoDictionaryKey:@"${envVarName}"])`;
        return Promise.resolve({
          handled: true,
          lineContent: macro,
          injectedText: macro,
          replacedText: lineContent
        });
      }
    }

    // Handle #define macros
    if (lineContent.includes('#define') && lineContent.includes(match)) {
        const macroParts = lineContent.trim().split(/\s+/);
        const varName = macroParts[1] || 'SECRET';
        const macro = `#define ${varName} ((NSString *)[[NSBundle mainBundle] objectForInfoDictionaryKey:@"${envVarName}"])`;
        return Promise.resolve({
            handled: true,
            lineContent: macro,
            injectedText: macro,
            replacedText: lineContent.trim()
        });
    }

    return Promise.resolve({ handled: false });
  },

  /**
   * Lifecycle Hook: postFix
   * Syncs Info.plist with new environment variables
   */
  postFix: async (context: PostFixContext): Promise<void> => {
    const { repoPath, envVarName, options, ext } = context;
    if (options.dryRun) return;
    
    // Only sync for code files that need Info.plist entry
    if (!['.swift', '.m', '.mm', '.h'].includes(ext)) return;

    const plistFiles = await glob('**/Info.plist', {
      cwd: repoPath,
      ignore: [
        '**/Pods/**', 
        '**/build/**', 
        '**/DerivedData/**', 
        '**/node_modules/**', 
        '**/maskedProject*/**',
        '**/*.xcframework/**',
        '**/*.framework/**'
      ],
      absolute: true
    });
    
    const mainPlist = plistFiles.find((p: string) => p.includes('Runner/Info.plist')) || 
                      plistFiles.find((p: string) => !p.includes('.framework') && !p.includes('Pods'));
    
    if (!mainPlist) return;

    try {
      let content = fs.readFileSync(mainPlist, 'utf8');
      if (content.includes(`<key>${envVarName}</key>`) || !content.includes('<dict>')) return;

      const dictStartIdx = content.indexOf('<dict>');
      const firstKeyIdx = content.indexOf('<key>', dictStartIdx);
      const injection = `\t<key>${envVarName}</key>\n\t<string>$(${envVarName})</string>\n`;
      
      let newContent: string;
      if (firstKeyIdx !== -1) {
        newContent = content.substring(0, firstKeyIdx) + injection + content.substring(firstKeyIdx);
      } else {
        const dictEndIdx = content.lastIndexOf('</dict>');
        newContent = content.substring(0, dictEndIdx) + injection + content.substring(dictEndIdx);
      }
      
      fs.writeFileSync(mainPlist, newContent);
    } catch (err) {
      // Log plist sync errors instead of silently swallowing
      const logger = (await import('../../utils/logger.js')).default;
      logger.debug(`Info.plist sync failed: ${(err as Error).message}`);
    }
  },

  setupBridge: async (repoPath: string): Promise<void> => {
    await setupIosBridge(repoPath);
  },

  teardownBridge: async (repoPath: string): Promise<void> => {
    // Logic to remove Podfile hooks and setup scripts
    const podfilePaths = await glob('**/Podfile', {
        cwd: repoPath,
        ignore: ['**/Pods/**', '**/node_modules/**', '**/build/**'],
        absolute: true
    });

    if (podfilePaths.length > 0) {
        const podfilePath = podfilePaths[0];
        let content = fs.readFileSync(podfilePath, 'utf8');
        
        // 1. Remove the function definition (with markers)
        const startMarker = '# --- Blinder Hook Start ---';
        const endMarker = '# --- Blinder Hook End ---';
        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            content = content.substring(0, startIndex) + content.substring(endIndex + endMarker.length);
        }

        // 2. Remove the call (always, for safety)
        content = content.replace(/^\s*blinder_post_install\(installer\)\s*$/gm, '');

        // 3. Clean up potentially empty post_install block if it only had our call
        const emptyBlockRegex = /post_install\s+do\s+\|installer\|\s+end\n?/g;
        content = content.replace(emptyBlockRegex, '');

        fs.writeFileSync(podfilePath, content);
    }

    const scriptPath = path.join(repoPath, 'blinder-ios-setup.sh');
    if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
    }
  },

  testCases: [
    {
      input: 'NSString *const API_KEY = @"secret";',
      expected: '#define API_KEY ((NSString *)[[NSBundle mainBundle] objectForInfoDictionaryKey:@"API_KEY"])',
      ext: '.m',
      envVarName: 'API_KEY'
    }
  ]
});
