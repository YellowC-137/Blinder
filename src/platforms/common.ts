/**
 * Common Platform Module
 * 
 * Base platform that always applies. Provides common extensions (.env, .json),
 * core gitignore templates, and a default auto-fix replacement.
 */
import { definePlatform } from './definePlatform.js';

export default definePlatform({
  id: 'common',
  name: 'Common Environment',
  category: 'core',

  detect: async (_repoPath: string): Promise<boolean> => {
    return true; // Common always applies
  },

  commonExtensions: ['.env', '.json'],

  sensitiveFiles: [
    // SSH / VPN / TLS 키 자산
    { glob: '**/id_rsa', severity: 'CRITICAL', reason: 'SSH 개인키 (절대 공유 금지)' },
    { glob: '**/*.ppk', severity: 'CRITICAL', reason: 'PuTTY 개인키' },
    { glob: '**/*.pem', severity: 'CRITICAL', reason: 'PEM 인코딩 인증서/개인키' },
    { glob: '**/*.key', severity: 'CRITICAL', reason: '개인키 파일' },
    { glob: '**/*.pfx', severity: 'CRITICAL', reason: 'PKCS#12 인증서/개인키' },
    { glob: '**/*.gpg', severity: 'HIGH', reason: 'GPG 암호화 자산' },
    { glob: '**/*.kdbx', severity: 'CRITICAL', reason: 'KeePass 비밀번호 데이터베이스' },
    { glob: '**/*.ovpn', severity: 'HIGH', reason: 'OpenVPN 설정 (자격증명 포함 가능)' },
    // 클라우드 / 패키지 매니저 자격증명
    { glob: '**/.aws/credentials', severity: 'CRITICAL', reason: 'AWS 액세스 키 자격증명' },
    { glob: '**/gcp-sa-key.json', severity: 'CRITICAL', reason: 'GCP 서비스 어카운트 키' },
    { glob: '**/service-account*.json', severity: 'CRITICAL', reason: 'GCP/기타 서비스 어카운트 키' },
    { glob: '**/.kube/config', severity: 'HIGH', reason: 'Kubernetes 클러스터 자격증명' },
    { glob: '**/*.kubeconfig', severity: 'HIGH', reason: 'Kubernetes 클러스터 자격증명' },
    { glob: '**/.docker/config.json', severity: 'HIGH', reason: 'Docker 레지스트리 인증 토큰' },
    { glob: '**/.netrc', severity: 'HIGH', reason: 'HTTP 자격증명 파일 (curl/git)' },
    { glob: '**/.npmrc', severity: 'HIGH', reason: 'npm 레지스트리 인증 토큰 포함 가능' },
    { glob: '**/.yarnrc', severity: 'HIGH', reason: 'Yarn 레지스트리 설정 (토큰 포함 가능)' },
    { glob: '**/auth.json', severity: 'HIGH', reason: 'Composer/일반 인증 토큰' },
    { glob: '**/.gem/credentials', severity: 'HIGH', reason: 'RubyGems API 키' },
    { glob: '**/.pypirc', severity: 'HIGH', reason: 'PyPI 자격증명' },
    // 환경변수 / 시크릿 컨벤션
    { glob: '**/.env.local', severity: 'HIGH', reason: '로컬 환경변수 (시크릿 포함 가능)' },
    { glob: '**/.env.production', severity: 'CRITICAL', reason: '운영 환경변수 (시크릿 포함)' },
    { glob: '**/.env.staging', severity: 'HIGH', reason: '스테이징 환경변수' },
    { glob: '**/.env.vault', severity: 'CRITICAL', reason: 'dotenv-vault 암호화 시크릿' },
    { glob: '**/secrets.yml', severity: 'CRITICAL', reason: '시크릿 설정 파일 (Rails 등)' },
    { glob: '**/secrets.yaml', severity: 'CRITICAL', reason: '시크릿 설정 파일' },
    { glob: '**/secrets.json', severity: 'CRITICAL', reason: '시크릿 설정 파일' },
    { glob: '**/master.key', severity: 'CRITICAL', reason: 'Rails master.key (config/credentials 복호화)' },
    { glob: '**/config/credentials/*.yml.enc', severity: 'HIGH', reason: 'Rails 암호화 자격증명 (master.key 동반)' },
    // 인프라 상태
    { glob: '**/*.tfstate', severity: 'CRITICAL', reason: 'Terraform 상태 (리소스 시크릿 포함)' },
    { glob: '**/terraform.tfvars', severity: 'HIGH', reason: 'Terraform 변수 (자격증명 포함 가능)' }
  ],

  commentRegex: /^\s*#/,

  ignorePaths: [
    '**/blinder_reports/**',
    '**/maskedProject_*/**',
    '**/*.pem',
    '**/*.key',
    '**/*.p12',
    '**/*.keystore',
    '**/*.jks'
  ],

  getGitignoreTemplate: (): string => `
# Blinder
.env
blinder_reports/
maskedProject_*/
.blinder_protect.json
blinder-ios-setup.sh
*.pem
*.key
*.p12
*.keystore
*.jks
secrets/
credentials/
`,

  getAutoFixReplacement: (_originalMatch: string, envVarName: string, _fileExtension: string, _options?: Record<string, unknown>): string => {
    return `process.env.${envVarName}`;
  },

  testCases: [
    {
      input: '"my-secret-value-12345"',
      expected: 'process.env.MY_SECRET',
      ext: '.json',
      envVarName: 'MY_SECRET'
    }
  ]
});
