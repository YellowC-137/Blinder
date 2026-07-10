/**
 * scanProject 기본 ignore 글롭 — 순수 데이터.
 * scanner.ts 의 스캔 엔진과 분리해 유지보수(패턴 추가/삭제)를 단순화.
 */
export const DEFAULT_IGNORE_PATTERNS: string[] = [
  '**/node_modules/**', '**/Pods/**', '**/Carthage/**', '**/vendor/**', '**/third_party/**',
  '**/build/**', '**/dist/**', '**/.git/**', '**/.env', '**/.blinder_maps/**',
  // 1. 키, 인증서 및 보안 파일
  '**/id_rsa', '**/id_rsa.pub', '**/*.ppk', '**/known_hosts',
  '**/*.pem', '**/*.cer', '**/*.crt', '**/*.p12', '**/*.keystore', '**/*.jks', '**/*.certSigningRequest',
  '**/.aws/credentials', '**/gcp-sa-key.json', '**/*.ovpn', '**/*.mobileprovision',
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
  '**/*.bson', '**/*.mdb', '**/*.accdb', '**/*.dbf'
];
