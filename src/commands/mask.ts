import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fg from 'fast-glob';
const { glob } = fg;
import logger from '../utils/logger.js';
import { scanProject } from '../detectors/scanner.js';
import { detectProjectType } from '../utils/detector.js';
import { performMasking } from '../services/maskingService.js';
import { t } from '../utils/i18n.js';
import type { MaskOptions, ScannerOptions } from '../platforms/types.js';

interface MaskCommandOptions extends MaskOptions {
  ignore?: string[];
  scanComments?: boolean;
}

export async function maskFiles(repoPath: string, options: MaskCommandOptions = {}): Promise<void> {
  let targetPath: string = '';
  let additionalIgnores: string = '';
  let scanComments: boolean = options.scanComments === true;
  if (!options.yes) {
    const response = await inquirer.prompt<{ targetPath: string; additionalIgnores: string; scanComments: boolean }>([
      {
        type: 'input',
        name: 'targetPath',
        message: t('prompt_target_subdir'),
        default: '',
        suffix: chalk.gray(t('prompt_target_subdir_hint'))
      },
      {
        type: 'input',
        name: 'additionalIgnores',
        message: t('prompt_exclude_dirs_mask'),
        default: ''
      },
      {
        type: 'confirm',
        name: 'scanComments',
        message: t('prompt_scan_comments'),
        default: false
      }
    ]);
    targetPath = response.targetPath;
    additionalIgnores = response.additionalIgnores;
    scanComments = response.scanComments;
  }

  const userIgnoreList: string[] = additionalIgnores
    .split(',')
    .map((p: string) => p.trim())
    .filter(Boolean);

  const absoluteTarget: string = targetPath ? path.resolve(repoPath, targetPath) : repoPath;
  if (!fs.existsSync(absoluteTarget)) {
    logger.error(t('mask_path_not_found', { path: absoluteTarget }));
    return;
  }

  const project = await detectProjectType(repoPath);
  const projectName: string = path.basename(repoPath);
  const defaultMaskOutput: string = `maskedProject_${projectName}`;
  const maskDir: string = path.join(repoPath, options.maskOutput || defaultMaskOutput);
  const maskOutputDirName: string = options.maskOutput || defaultMaskOutput;

  const excludePaths: string[] = [
    'node_modules/**',
    '.git/**',
    `${maskOutputDirName}/**`,
    'blinder_reports/**',
    '.env',
    '.env.example',
    '.blinder_map.json',
    'Pods/**',
    'build/**',
    'dist/**',
    '.dart_tool/**',
    '.gradle/**',
    '**/*.jks',
    '**/*.keystore',
    '**/*.p12',
    '**/*.mobileprovision',
    '**/*Tests/**',
    '**/*Test/**',
    '**/*.xctest/**',
    '**/test/**',
    '**/androidTest/**',
    // 1. 키, 인증서 및 보안 파일
    '**/id_rsa', '**/id_rsa.pub', '**/*.ppk', '**/known_hosts',
    '**/*.pem', '**/*.cer', '**/*.crt', '**/*.certSigningRequest',
    '**/.aws/credentials', '**/gcp-sa-key.json', '**/*.ovpn',
    // 2. 메모리 덤프 및 런타임 로그
    '**/*.hprof', '**/*.dump', '**/core.*',
    '**/*.log', '**/*.crash', '**/*.out',
    '**/*.sqlite', '**/*.db', '**/*.realm',
    // 3. 인프라 배포 및 환경 설정 스크립트
    '**/*.sh', '**/*.bat', '**/*.command',
    '**/*.tfstate', '**/terraform.tfvars',
    '**/Fastfile', '**/Appfile', '**/Matchfile',
    // 4. 로컬 빌드 환경 변수
    '**/local.properties', '**/.npmrc', '**/.yarnrc',
    // 5. 모바일 빌드 산출물 / Xcode-IDE 캐시
    '**/*.dSYM/**', '**/*.ipa', '**/*.app/**', '**/*.xcarchive/**',
    '**/xcuserdata/**', '**/*.xcuserstate',
    '**/*.apk', '**/*.aab', '**/*.iml', '**/*.bks',
    '**/lint-results-*.xml', '**/lint-baseline.xml',
    // 6. Flutter 자동생성 / 데스크톱 플랫폼
    '**/.flutter-plugins', '**/.flutter-plugins-dependencies',
    '**/Generated.xcconfig', '**/flutter_export_environment.sh',
    '**/.metadata', '**/.last_build_id',
    // 7. 패키지 매니저 인증 / IDE 워크스페이스
    '**/.netrc', '**/_netrc',
    '**/.docker/config.json', '**/.dockercfg',
    '**/.kube/config', '**/*.kubeconfig', '**/.htpasswd',
    '**/auth.json', '**/.composer/auth.json',
    '**/.bundle/config', '**/.gem/credentials',
    '**/.pypirc', '**/.cargo/credentials', '**/.cargo/credentials.toml',
    '**/.idea/workspace.xml', '**/.idea/dataSources.xml', '**/.idea/dataSources/**',
    '**/.vscode/sftp.json',
    // 8. 환경변수 변형 / Rails 시크릿 / 일반 시크릿 컨벤션
    '**/.env.local', '**/.env.*.local',
    '**/.env.development', '**/.env.production', '**/.env.staging', '**/.env.test',
    '**/.env.vault',
    '**/secrets.yml', '**/secrets.yaml', '**/secrets.json', '**/*.secrets',
    '**/*.kdbx', '**/*.kdb',
    '**/master.key', '**/.master.key',
    '**/config/master.key', '**/config/credentials/*.yml.enc',
    '**/service-account*.json', '**/*-credentials.json', '**/credentials.json',
    '**/.firebaserc', '**/firebase-debug.log',
    // 9. 추가 인증/암호화 자산
    '**/*.pfx', '**/*.gpg', '**/*.asc', '**/*.enc',
    // 10. 백업 / 임시 / OS 메타
    '**/*.swp', '**/*.swo', '**/*.bak', '**/*.backup', '**/*~',
    '**/.DS_Store', '**/Thumbs.db',
    // 11. 컴파일 산출물 / 네이티브 라이브러리 / 압축
    '**/*.class', '**/*.jar', '**/*.aar', '**/*.war', '**/*.ear',
    '**/*.so', '**/*.a', '**/*.dll', '**/*.dylib', '**/*.lib',
    '**/*.pyc', '**/__pycache__/**',
    '**/*.zip', '**/*.tar', '**/*.tar.gz', '**/*.tgz', '**/*.7z', '**/*.rar',
    '**/*.dmg', '**/*.pkg',
    // 12. DB 데이터 덤프 추가
    '**/*.sql', '**/*.sql.gz', '**/dump.sql',
    '**/*.bson', '**/*.mdb', '**/*.accdb', '**/*.dbf',
    ...(options.ignore || []),
    ...userIgnoreList
  ];

  if (userIgnoreList.length) {
    logger.info(t('excluding_user_patterns', { patterns: userIgnoreList.join(', ') }));
  }

  logger.info(t('mask_indexing'));

  const relTarget: string = path.relative(repoPath, absoluteTarget) || '.';
  const allFiles: string[] = await glob(`${relTarget}/**/*`, {
    cwd: repoPath,
    ignore: excludePaths,
    dot: true,
    absolute: false
  });

  const scanOptions: ScannerOptions = {
    ...options,
    ignore: [...(options.ignore || []), ...userIgnoreList],
    scanComments
  };
  const results = await scanProject(repoPath, project.platforms, scanOptions);
  
  logger.info(t('mask_into', { dir: maskDir }));
  await performMasking(repoPath, allFiles, results, maskDir, options);

  logger.header(t('mask_complete'));
  logger.info(t('mask_safe_copy', { dir: maskDir }));
  logger.success(t('mask_mapping_saved', { path: `${maskDir}/.blinder_map.json` }));
  logger.warn(t('mask_note_ai'));
}
