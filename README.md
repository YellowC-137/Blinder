# Blinder 🛡️

[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_en.md)

**Blinder**는 AI 에이전트(Cursor, ChatGPT, Claude 등)에 코드를 넘기기 전, 소스 속의 민감정보가 외부로 유출되는 것을 사전에 방지하는 **AI 시대의 보안 자동화 도구**입니다.

모바일(iOS, Android, Flutter)부터 백엔드(Spring Boot, Node.js 등)까지, **플러그인 아키텍처**를 통해 모든 플랫폼의 하드코딩된 API 키를 탐지하고, 두 가지 워크플로(`blind` 또는 `mask`)로 분리해서 안전하게 처리합니다.

---

## ✨ 핵심 기능

- **🔍 AST 기반 정밀 검증 (Phase-Gate)**: `web-tree-sitter` AST 분석으로 실제 문자열 리터럴 여부를 검증하여 주석/코드 외 영역 오탐을 최소화. (iOS/Android/Flutter 우선 지원)
- **⚡ 하이브리드 I/O**: 파일 크기에 따라 `readFileSync`와 `readline` 스트림을 전환. 대용량 프로젝트에서도 메모리 점유율 최소.
- **🛡️ 자동 환경변수 변환 (Auto-fix)**: 탐지된 시크릿을 `.env`로 옮기고 플랫폼별(Dart/Kotlin/Swift/Obj-C/Java) 환경변수 접근 코드로 자동 치환.
- **🔌 플러그인 아키텍처**: `BasePlatform` 상속으로 신규 언어/프레임워크 손쉽게 추가.
- **📜 멀티라인 시크릿 탐지**: 일반 문자열뿐만 아니라 PEM Private Key, 인증서 등 여러 줄 데이터까지 처리.
- **📊 자동 리포트 & CI 지원**: `blinder_reports/`에 스캔 이력 저장. `--ci` / `-y` 모드로 파이프라인 통합.
- **🗝️ 구조화 파일 검출 + 화이트리스트**: Info.plist, AndroidManifest meta-data, gradle.properties 등 구조화 파일을 키 단위로 파싱하고, SDK 키만 자동치환 대상으로 분류 (시스템 키 자동 제외).

---

## 🚀 시작하기

### 설치

```bash
# 저장소 클론
git clone https://github.com/YellowC-137/Blinder.git
cd Blinder
npm install
sudo npm link
```

OR

```bash
npm install -g github:YellowC-137/Blinder
```

---

## 🔀 두 워크플로 비교

| 구분 | `blind` 워크플로 | `mask` 워크플로 |
|---|---|---|
| **목적** | 시크릿을 `.env`로 분리, **코드 실행 가능 유지** | AI가 비즈니스 로직만 읽도록 시크릿 완전 제거 |
| **원본 코드** | 직접 수정 (env 접근자 치환) | 변경 없음 (별도 복사본 생성) |
| **결과물 빌드 가능 여부** | ✅ 빌드 가능 (bridge 설정 필요) | ❌ **빌드 불가 — 읽기 전용** |
| **사용 시나리오** | 운영 환경 / 팀 공유 / Git 커밋 | AI 코드 리뷰 / 외부 SDK 분석 / 외부 공유 |
| **대응 명령** | `blinder blind` ↔ `blinder rollback` | `blinder mask` ↔ `blinder restore` |
| **수정 결과 처리** | 그대로 사용 (env 로드만 보장) | `restore`로 원본에 다시 머지 |

---

## 📋 명령어 가이드

명령어는 **목적에 따라 두 그룹으로 나뉩니다**. 각 그룹 안에서 짝을 이루는 명령(원상복구/머지)이 있습니다.

### 🟦 그룹 A: `blind` 워크플로 — 실행 가능 상태 유지

> 원본 소스코드를 직접 수정하여 시크릿을 `.env`로 분리. 분리 후에도 빌드/실행이 정상 동작하도록 빌드 시스템을 자동 연동.

#### A-1. `blinder blind` — 시크릿 분리 + 자동 치환
시크릿 탐지 → `.env` 생성 → 소스코드를 환경변수 접근자로 자동 치환 → `.gitignore` 자동 갱신을 한 번에 수행. (`scan` + `protect` + `gitignore` 통합)
- **인터랙티브 모드**: 수정 대상 파일 목록 + 추가 제외 폴더(외부 SDK 등) 확인 단계 제공.
- `-y, --yes`: 모든 프롬프트 자동 'yes' 처리. CI/CD 적합.
- `--dry-run`: 실제 수정 없이 변경 미리보기.

> [!CAUTION]
> **원본 소스 직접 수정**: `build.gradle`, `.pbxproj`, `Info.plist` 등 빌드 핵심 파일이 변경됩니다. 실행 전 반드시 **`git commit` 완료** 후 진행하세요.

#### A-2. `blinder bridge` — 빌드 시스템 연동
`.env` 값을 각 플랫폼 빌드 시스템이 자동 인식하도록 설정. 플랫폼별 `setupBridge()` 호출.
- **Android**: `app/build.gradle`에 `BuildConfig` 자동 주입 + `manifestPlaceholders` 등록.
- **iOS (Native + Flutter)**: `Podfile`의 `post_install` 훅 자동 추가. `pod install` 시 'Blinder Env Loader' Run Script Phase 자동 구성.
- **Flutter**: VS Code/IntelliJ 실행 설정에 `--dart-define-from-file=.env` 자동 추가 + `f.sh` CLI 래퍼 생성.

> [!WARNING]
> **iOS Podfile 부재 시 (수동 설정 필수)**: `blinder-ios-setup.sh` 가이드 따라 Xcode `Build Phases`에 직접 등록. 'Based on dependency analysis' **체크 해제** + 'User Script Sandboxing' **NO** 설정 필수.

#### A-3. `blinder rollback` — `blind` 원상 복구 (↔ A-1 대응)
`blind`/`protect`로 적용된 환경변수 접근자 치환을 취소하고 하드코딩된 원본 상태로 복원. `.blinder_protect.json` 메타데이터를 기반으로 정확한 위치 복원. Blinder 생성 파일(.env, gitignore 추가 라인 등) 일괄 삭제 옵션 제공.

> [!IMPORTANT]
> `.blinder_protect.json` 손상/유실 시 정확한 위치 복원 불가 → 항상 `blind` 직후 `git commit` 권장.

---

### 🟩 그룹 B: `mask` 워크플로 — AI 공유용 (실행 불가)

> 원본 코드를 그대로 두고 **마스킹된 사본**을 생성. AI가 비즈니스 로직만 읽도록 모든 시크릿/민감 파일을 제거.

#### B-1. `blinder mask` — AI 공유용 사본 생성
프로젝트 전체 또는 지정 하위 디렉토리를 복사하여 `maskedProject_<projectName>/` 생성. 모든 시크릿은 `__BLINDER_VAR__` 토큰으로 치환되며, 다음 항목은 사본에서 **완전 제외**:
- SSH/PGP/TLS 키, 인증서 (`*.pem`, `*.p12`, `id_rsa`, ...)
- 클라우드/패키지 매니저 자격증명 (`.aws/credentials`, `.npmrc`, `.kube/config`, ...)
- 빌드 산출물 (`*.apk`, `*.ipa`, `*.dSYM`, `xcuserdata/`, ...)
- 환경변수 변형 (`.env.local`, `.env.production`, ...)
- 백업/IDE 임시 파일 (`*.bak`, `.idea/workspace.xml`, ...)
- DB 덤프, 컴파일 산출물, 압축 파일

생성된 사본 안에 `.blinder_map.json`이 함께 저장되어 `restore` 시 시크릿 매핑에 사용됩니다.

> [!CAUTION]
> ## 🚨 `mask` 결과물은 **실행 불가**합니다 🚨
> - ❌ **빌드/실행 절대 시도 금지** — 모든 시크릿 값이 `__BLINDER_VAR__` 토큰으로 치환되어 컴파일 에러 또는 런타임 NPE 발생
> - ❌ **마스킹된 사본을 실제 환경에 배포 금지**
> - ❌ **AI에게 "빌드해서 검증해줘" 요청 금지** — 빌드 자체가 실패함
> - ✅ **읽기 전용** — AI가 코드 구조/로직 파악, 리팩토링 제안, 버그 진단 등에 활용
> - ✅ **수정된 결과는 `blinder restore`로 원본 프로젝트에 다시 머지** (이때 시크릿이 자동 복원됨)
>
> 실행 가능한 워크플로가 필요하면 `blinder blind`를 사용하세요.

> [!NOTE]
> **왜 `.env` 접근만 차단하지 않고 `mask`를 사용하나?**
> 1. **원본 무수정 (비침투적)**: `blind`는 원본을 변경하지만, `mask`는 별도 사본만 만듭니다.
> 2. **외부 공유**: ChatGPT 웹 / 외부 협업자에게 압축 전달할 때 시크릿이 물리적으로 제거된 폴더가 필요.
> 3. **실행 로그 유출 방지**: 실제 빌드/실행 시 메모리에 적재된 시크릿이 터미널 로그에 출력될 위험. 마스킹된 사본은 빌드 자체가 불가하므로 이 리스크 원천 차단.
> 4. **Git 기록 보호**: 파일 접근만 막아도 이전 커밋의 하드코딩된 시크릿을 AI가 읽어낼 수 있음.

#### B-2. `blinder restore` — AI 수정 결과 머지 (↔ B-1 대응)
AI가 마스킹된 사본에서 작업한 **모든 코드 변경 + 신규 파일**을 원본 프로젝트로 안전하게 가져옴. `__BLINDER_VAR__` 토큰은 자동으로 실제 시크릿 값으로 복원. import 누락 등의 정합성 자동 보정 포함.

> [!WARNING]
> 사본 안의 `.blinder_map.json`이 변조/삭제되면 시크릿 복원 불가. AI에게 "맵 파일 정리해줘" 같은 요청 금지.

---

### 🟨 그룹 C: 보조 명령

#### C-1. `blinder scan` — 수동 스캔 (수정 없음)
시크릿 탐지 + 상세 리포트 생성. 코드 수정 없음.
- `--ci`: 시크릿 발견 시 비-0 종료 코드 → CI 파이프라인 차단.
- `-o <file>`: JSON 결과 출력.

#### C-2. `blinder gitignore` — `.gitignore` 자동 보강
감지된 플랫폼별 템플릿(.env, build/, *.jks, ...) + Blinder 생성 파일을 `.gitignore`에 추가.

#### C-3. `blinder help` — 도움말
모든 명령어 + 옵션 출력.

---

## 🛠️ 프로젝트 설정 (`.blinderSettings`)

프로젝트 루트에 `.blinderSettings` (JSON) 생성으로 동작 커스터마이즈 가능. 외부 SDK / 보안 라이브러리는 이 설정으로 안전하게 제외.

### 옵션
- `ignorePaths`: 스캔 + Auto-fix 제외 경로 (Glob)
- `customPatterns`: 프로젝트 고유 시크릿 패턴 (Regex + severity)
- `maskOutput`: `mask` 결과 폴더명 (기본: `maskedProject_<projectName>`)

### 예시

```json
{
  "ignorePaths": [
    "Library/RSKSW/**",
    "Library/mVaccine/**",
    "**/test/mocks/**"
  ],
  "customPatterns": [
    { "name": "Internal API", "regex": "INTERNAL_[A-Z]{3}_KEY_[0-9a-f]{32}", "severity": "CRITICAL" }
  ],
  "maskOutput": ".blinder_masked_project"
}
```

> [!TIP]
> **휴리스틱 자동 보호**: 별도 설정 없이도 파일 상단에 `Copyright`, `SDK`, `Third-party` 문구가 있으면 외부 라이브러리로 인식하여 자동 제외.

---

## 🔧 플랫폼별 Auto-fix 예시 (`blind` 워크플로)

| 플랫폼 | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter (Dart)** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android (Kotlin/Java)** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS (Swift)** | `"glpat...789"` | `(Bundle.main.object(forInfoDictionaryKey: "GITLAB_TOKEN") as? String ?? "")` |
| **iOS (Obj-C)** | `NSString *const API_URL = @"..."` | `#define API_URL [[NSBundle mainBundle] objectForInfoDictionaryKey:@"API_URL"]` |

### ⚠️ 플랫폼별 Auto-fix 유의사항

> `mask` 워크플로는 단순 토큰 치환이라 언어 제약 무관 — 아래 caveats는 **`blind`(Auto-fix)에만 해당**합니다.

#### 🍎 iOS (Objective-C)
- **전역 상수**: `NSString *const`는 C 컴파일타임 제약으로 런타임 함수 직접 사용 불가 → Blinder가 `#define` 매크로로 자동 마이그레이션.
- **주의**: `int`/`double` 등 원시 타입 상수는 자동치환 제외. 필요 시 수동 처리.

#### 🍏 iOS (Swift)
- Swift는 런타임 평가 지원 → `Bundle.main.object(forInfoDictionaryKey:...)` 주입 OK.
- **주의**: 실제 런타임에 값이 채워지려면 `.xcconfig` + `Info.plist`가 `.env`를 읽도록 빌드세팅 연동 필수. → `blinder bridge`가 자동화.

#### 🤖 Android (Kotlin / Java)
- 기본 치환: `BuildConfig.VARIABLE_NAME`. 컴파일 위해 `build.gradle`에 BuildConfig 동적 생성 스크립트 필요 → `blinder bridge`가 자동 주입.
- `.xml` 파일 (예: `AndroidManifest.xml`): `${VARIABLE_NAME}` placeholder 치환. `manifestPlaceholders` 등록 필요 → bridge가 처리.

#### 🦋 Flutter (Dart)
- `String.fromEnvironment('VAR')` 치환.
- **필수**: 빌드 시 `--dart-define-from-file=.env` 플래그 명시. → bridge가 IDE 실행 설정 + `f.sh` 래퍼 자동 추가.

### 🛡️ 구조화 파일 자동치환 정책 (안전장치)

`Info.plist`, `AndroidManifest.xml`, `gradle.properties`는 키 이름 화이트리스트 기반으로만 자동치환:

| 파일 | 자동치환 대상 (whitelist) | 차단 대상 (blacklist) |
|---|---|---|
| Info.plist | `KAKAO_*`, `NAVER_*`, `GMSApiKey`, `FacebookAppID`, `*_API_KEY` 등 | `CFBundle*`, `NS*`, `UI*`, `LS*` 시스템 키 |
| AndroidManifest meta-data | `com.kakao.sdk.*`, `com.google.android.geo.API_KEY` 등 | `androidx.*`, `com.google.android.gms.version` |
| gradle.properties | 키 이름에 `API_KEY`/`TOKEN`/`PASSWORD` 등 힌트 포함 | `org.gradle.*`, `android.*`, `kotlin.*` |
| local.properties | (영구 차단) | 모든 키 — gitignore 대상 |
| .xcconfig | (영구 차단 — 자기참조 위험) | 모든 키 |

화이트리스트 외 키는 검출은 되지만 자동치환은 적용되지 않으며, 사용자에게 경고만 표시됩니다.

---

## 🔌 신규 플랫폼 추가 가이드 (Plugin Architecture)

코어 엔진 수정 없이 새 언어/프레임워크 지원 가능.

### 가장 빠른 방법: CLI 자동 생성

```bash
blinder add_platform
```

대화형 프롬프트로 플러그인 파일 생성 + 레지스트리 등록 자동화. 카테고리(Backend, Frontend, Mobile) 선택 또는 Custom 정의. 자세한 내용 [CONTRIBUTING.md](./CONTRIBUTING.md) 참고.

### 직접 작성: 최소 템플릿

```javascript
// src/platforms/backend/python.js
import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'python',
  name: 'Python',
  category: 'backend',
  detect: async (repoPath) => fs.existsSync(path.join(repoPath, 'requirements.txt')),
  commonExtensions: ['.py'],
  getAutoFixReplacement: (match, envVarName) => `os.environ.get("${envVarName}")`
});
```

`src/platforms/index.js` 등록:

```javascript
import python from './backend/python.js';

export const platforms = [
  common, ios, android, flutter,
  python
];
```

### 검증

```bash
blinder scan --path /your/python-project --dry-run
blinder blind --path /your/python-project --dry-run -y
```

<details>
<summary><strong>📖 고급 플러그인 API (Bridge, Advanced Fix, Lifecycle Hooks)</strong></summary>

#### 전체 IPlatform 인터페이스

| 속성/메서드 | 타입 | 필수 | 설명 |
|:---|:---|:---:|:---|
| `id` | `string` | ✅ | 고유 식별자 |
| `name` | `string` | ✅ | 표시명 |
| `category` | `string` | ✅ | `core` / `mobile` / `backend` / `web` |
| `detect(repoPath)` | `async → bool` | ✅ | 프로젝트 유형 판별 |
| `commonExtensions` | `string[]` | ✅ | 스캔 대상 확장자 |
| `sensitiveFiles` | `object[]` | | 민감 파일 (`glob`, `severity`, `reason`) |
| `commentRegex` | `RegExp` | | 주석 행 판별 |
| `ignorePaths` | `string[]` | | 스캔 제외 경로 |
| `getGitignoreTemplate()` | `→ string` | | .gitignore 섹션 |
| `getAutoFixReplacement(match, envVarName, ext, options)` | `→ string` | | 환경변수 접근자 |
| `applyAdvancedFix(context)` | `→ object` | | 복잡 변환 (Stage 1) |
| `preFix(context)` | `async` | | 수정 전 훅 |
| `postFix(context)` | `async` | | 수정 후 훅 |
| `setupBridge(repoPath)` | `async` | | 빌드 시스템 연동 |
| `teardownBridge(repoPath)` | `async` | | 연동 해제 |
| `testCases` | `object[]` | | 검증 케이스 |

#### 라이프사이클 실행 순서

```text
┌─────────────────────────────────────────────────┐
│ protect.js: applyAutoFixes()                    │
│                                                 │
│  for each file:                                 │
│    1. preFix()          ← 수정 전 준비           │
│    2. for each secret:                          │
│       a. applyAdvancedFix()  ← Stage 1 (고급)   │
│       b. getAutoFixReplacement() ← Stage 2      │
│    3. postFix()         ← 수정 후 후처리         │
└─────────────────────────────────────────────────┘
```

#### 고급 예시 (Spring Boot)

```javascript
import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'springboot',
  name: 'Spring Boot',
  category: 'backend',

  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'pom.xml')) ||
           fs.existsSync(path.join(repoPath, 'build.gradle'));
  },

  commonExtensions: ['.java', '.properties', '.yml', '.yaml', '.xml'],

  sensitiveFiles: [
    { glob: '**/application-secret.yml', severity: 'CRITICAL', reason: '프로덕션 DB/API 키' },
    { glob: '**/application-prod.properties', severity: 'HIGH', reason: '프로덕션 환경 설정' }
  ],

  ignorePaths: ['**/target/**', '**/.mvn/**', '**/build/**'],

  getGitignoreTemplate: () => `
# Spring Boot
target/
*.jar
*.war
application-secret.yml
`,

  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.java') return `System.getenv("${envVarName}")`;
    if (ext === '.properties' || ext === '.yml') return `\${${envVarName}}`;
    return `process.env.${envVarName}`;
  }
});
```

</details>

---

## ⚠️ 공통 주의사항

> [!IMPORTANT]
> **모든 명령 실행 전 `git commit` 필수**: Blinder가 수정한 변경사항 검토 + 필요 시 즉시 되돌리기 위함.

> [!WARNING]
> **`.env` 파일 관리**: Blinder가 `.gitignore`에 자동 추가하지만, 최종 커밋 전 `.env`가 Git tracked가 아닌지 수동 확인 권장.

> [!WARNING]
> **벤더 라이브러리 빌드 영향**: KeySharp, RSKSW 등 사내 보안 라이브러리는 키 길이 검증 등 자체 제약이 있을 수 있음. `.blinderSettings`의 `ignorePaths`로 제외 후 적용 권장.
