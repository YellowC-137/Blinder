/**
 * Comprehensive secret detection patterns aligned with enterprise security guidelines.
 * Covers: Auth/Keys, Infrastructure, DB credentials, SDK keys, and crypto artifacts.
 */
export const patterns = [
  // ─── Objective-C Specific Patterns (Catch all config variables) ───
  {
    name: 'Objective-C Config String',
    regex: /(?:NSString\s*\*\s*const|const\s+NSString\s*\*|extern\s+NSString\s*\*|NSString\s*\*)\s+([a-zA-Z0-9_]+)\s*=\s*@?["']([\s\S]*?)["']\s*;/gi,
    severity: 'HIGH'
  },
  {
    name: 'Objective-C Macro String',
    regex: /#define\s+([a-zA-Z0-9_]+)\s+@?["']([\s\S]*?)["'](?:\s*\/\/.*)?/gi,
    severity: 'HIGH'
  },

  // ─── Platform-specific API Keys ───
  {
    name: 'Google API Key',
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'AWS Access Key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'Firebase API Key',
    regex: /"api_key":\s*"([^"]+)"/g,
    severity: 'HIGH'
  },

  // ─── Git Provider Tokens ───
  {
    name: 'GitHub PAT',
    regex: /\bghp_[a-zA-Z0-9]{36}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'GitHub Fine-grained PAT',
    regex: /\bgithub_pat_[a-zA-Z0-9_]{82}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'GitLab Personal Access Token',
    regex: /\bglpat-[0-9a-zA-Z\-_]{20}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'GitLab Pipeline Trigger Token',
    regex: /\bglptt-[0-9a-f]{40}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'GitLab Runner Token',
    regex: /\bglrt-[0-9a-zA-Z\-_]{20,}\b/g,
    severity: 'HIGH'
  },

  // ─── Payment / SaaS Tokens ───
  {
    name: 'Stripe Live Secret Key',
    regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g,
    severity: 'CRITICAL'
  },
  {
    name: 'Stripe Test Secret Key',
    regex: /\bsk_test_[0-9a-zA-Z]{24,}\b/g,
    severity: 'MEDIUM'
  },
  {
    name: 'Slack Webhook',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9_]{8}\/B[A-Z0-9_]{8}\/[A-Za-z0-9_]{24}/g,
    severity: 'HIGH'
  },

  // ─── Cryptographic Material ───
  {
    name: 'Private Key',
    regex: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,
    severity: 'CRITICAL',
    multiline: true
  },

  // ─── Database Connection Strings (보안지침 §1: 인프라 정보) ───
  {
    name: 'Database Connection String',
    regex: /\b((?:mysql|postgresql|postgres|mongodb|redis|mssql):\/\/[^\s"'<>]{10,})/gi,
    severity: 'CRITICAL'
  },

  // ─── IPv4 Address (보안지침 §1: 인프라 정보 - Public 및 Private 모두 포함) ───
  {
    name: 'IPv4 Address',
    regex: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: 'MEDIUM',
    isFixable: false
  },

  // ─── Network Host / Domain Configs ───
  {
    name: 'Network Host / Domain',
    regex: /\b[a-zA-Z0-9_]*(?:ip|host|domain|addr)\b\s*[:=]\s*@?["']([a-zA-Z0-9.\-]{4,})["']/gi,
    severity: 'MEDIUM'
  },
  
  // ─── Network Port Configs (e.g., let icrpPt = "10500") ───
  {
    name: 'Network Port / Config',
    regex: /\b[a-zA-Z0-9_]*(?:port|pt)\b\s*(?::\s*[a-zA-Z0-9_]+\s*)?=\s*["']?(\d{2,5})["']?/gi,
    severity: 'MEDIUM',
    isFixable: false
  },

  // ─── Endpoint & Server URLs ───
  {
    name: 'Endpoint URL',
    // Captures full URL, skips public schemas, and excludes URLs with string interpolation ($, \(, ${) to avoid matching non-static secrets.
    regex: /((?:https?):\/\/(?!(?:[a-zA-Z0-9.-]+\.)?(?:schemas\.android\.com|w3\.org|apple\.com|developer\.apple\.com|github\.com|gitlab\.com|bitbucket\.org|kisa\.or\.kr|googletagmanager\.com|facebook\.com|firebase\.google\.com|google\.com|microsoft\.com|adobe\.com|apache\.org|ns\.adobe\.com))(?![^\s"'<>;]*[\$\\][\({])(?:[a-zA-Z0-9.-]+)(?::\d+)?(?:[^\s"'<>;]*[^\s"'<>;.,])?)/gi,
    severity: 'MEDIUM'
  },

  // ─── Hardcoded Passwords (보안지침 §1: 인증 정보) ───
  {
    name: 'Hardcoded Password',
    regex: /\b(password|passwd|db_password|dbpassword|storePassword|keyPassword|key_password)\s*[:=]\s*@?["']([^"']{6,})["']/gi,
    severity: 'CRITICAL'
  },
  {
    name: 'Sentry DSN',
    regex: /https:\/\/[a-f0-9]{32}@[a-z0-9.]+\/\d+/g,
    severity: 'HIGH'
  },

  // ─── OAuth Client Secret ───
  {
    name: 'OAuth Client Secret',
    regex: /\b(client[_-]?secret|clientsecret)\s*[:=]\s*@?["']([A-Za-z0-9_\-]{16,})["']/gi,
    severity: 'HIGH'
  },

  // ─── Korean SDK Keys (보안지침 §2: iOS Info.plist, AppDelegate) ───
  {
    name: 'Kakao SDK App Key',
    regex: /\b(kakao[_-]?(app[_-]?key|native[_-]?key|api[_-]?key))\s*[:=]\s*@?["']([A-Za-z0-9]{20,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Naver SDK Client ID/Secret',
    regex: /\b(naver[_-]?(client[_-]?id|client[_-]?secret|api[_-]?key))\s*[:=]\s*@?["']([A-Za-z0-9_\-]{10,})["']/gi,
    severity: 'HIGH'
  },

  // ─── Crypto Salt / IV (보안지침 §4: 암복호화 로직) ───
  {
    name: 'Hardcoded Crypto Salt/IV',
    regex: /\b(salt|iv|initialization[_-]?vector)\s*[:=]\s*@?["']([A-Za-z0-9+/=]{8,})["']/gi,
    severity: 'HIGH'
  },

  // ─── AndroidManifest meta-data API Key (보안지침 §2: Android) ───
  {
    name: 'Android Manifest API Key',
    regex: /android:value\s*=\s*"([A-Za-z0-9_\-]{20,})"/g,
    severity: 'HIGH'
  },

  // ─── Mobile Specific Identifiers (보안지침 §2: iOS/Android) ───
  {
    name: 'Facebook App ID / Client Token',
    regex: /\b(facebook[_-]?(app[_-]?id|client[_-]?token))\s*[:=]\s*@?["']([A-Za-z0-9]{15,})["']/gi,
    severity: 'MEDIUM'
  },
  {
    name: 'iOS Keychain Identifier',
    regex: /\b(kSecAttr(?:Service|Account|AccessGroup|Generic)|kSecClass(?:GenericPassword)?|kSecValueData|kSecReturnData|kSecMatchLimit(?:One)?|kSecAttrAccessible)\b/g,
    severity: 'LOW',
    isFixable: false
  },
  {
    name: 'Apple Team ID',
    regex: /\b(?:DEVELOPMENT_TEAM|TeamID|TEAM_ID)\s*[:=]\s*@?["']?([A-Z0-9]{10})["']?/gi,
    severity: 'LOW',
    isFixable: false
  },

  // ─── Generic patterns (catch-all) ───
  {
    name: 'Generic API Key',
    regex: /\b([a-zA-Z0-9_]*key)\s*[:=]\s*@?["']([A-Za-z0-9_\-\.]{20,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Generic Secret',
    regex: /\b([a-zA-Z0-9_]*secret)\s*[:=]\s*@?["']([A-Za-z0-9_\-\.]{16,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Generic Token',
    regex: /\b([a-zA-Z0-9_]*token)\s*[:=]\s*@?["']([A-Za-z0-9_\-\.]{20,})["']/gi,
    severity: 'HIGH'
  },
];

export const platformExtensions = {
  flutter: ['.dart', '.yaml', '.xml', '.plist'],
  ios: ['.swift', '.m', '.h', '.mm', '.plist', '.xcconfig'],
  android: ['.kt', '.java', '.xml', '.gradle', '.properties', '.json']
};

/**
 * Sensitive files that should NEVER be committed to Git.
 * (보안지침 §2: 플랫폼별 상세 체크리스트)
 */
export const sensitiveFiles = [
  // iOS
  { glob: '**/GoogleService-Info.plist', severity: 'CRITICAL', platform: 'ios', reason: 'Firebase 설정 및 API 키가 포함된 파일' },
  { glob: '**/*.xcconfig', severity: 'HIGH', platform: 'ios', reason: '서버 주소 및 키 정보가 담긴 환경 설정 파일' },
  { glob: '**/*.mobileprovision', severity: 'HIGH', platform: 'ios', reason: 'iOS 프로비저닝 프로필 (앱 배포 및 권한 정보)' },
  { glob: '**/*.provisionprofile', severity: 'HIGH', platform: 'ios', reason: 'iOS 프로비저닝 프로필 (앱 배포 및 권한 정보)' },
  { glob: '**/*.entitlements', severity: 'MEDIUM', platform: 'ios', reason: 'iOS 앱 권한 및 Keychain Access Group 정보' },
  { glob: '**/*.p12', severity: 'CRITICAL', platform: 'ios', reason: '인증서 및 개인키가 포함된 보안 파일 (유출 시 위험)' },
  { glob: '**/*.pfx', severity: 'CRITICAL', platform: 'ios', reason: '인증서 및 개인키가 포함된 보안 파일 (유출 시 위험)' },
  // Android
  { glob: '**/google-services.json', severity: 'CRITICAL', platform: 'android', reason: 'Google 서비스 인증 정보가 포함된 파일' },
  { glob: '**/local.properties', severity: 'HIGH', platform: 'android', reason: 'SDK 경로 및 API Key가 저장될 수 있는 파일' },
  { glob: '**/gradle.properties', severity: 'HIGH', platform: 'android', reason: 'API Key, KeyStore 비밀번호가 저장될 수 있는 파일' },
  { glob: '**/*.jks', severity: 'CRITICAL', platform: 'android', reason: '앱 서명 키 파일 (유출 시 치명적)' },
  { glob: '**/*.keystore', severity: 'CRITICAL', platform: 'android', reason: '앱 서명 키 파일 (유출 시 치명적)' },
  // Flutter
  { glob: '**/generated_plugin_registrant.dart', severity: 'MEDIUM', platform: 'flutter', reason: '내부 경로가 노출될 수 있는 자동 생성 파일' },
];
