# Blinder 🛡️

[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_en.md)

**Blinder**는 AI 에이전트(Cursor, ChatGPT, Claude 등)를 사용할 때 소스 코드 속의 민감정보가 외부로 유출되는 것을 사전에 방지하는 **AI 시대의 보안 자동화 도구**입니다.

모바일(iOS, Android, Flutter)부터 백엔드(Spring Boot, Node.js 등)까지, **플러그인 아키텍처**를 통해 모든 플랫폼의 하드코딩된 API 키를 탐지하고, 이를 안전하게 `.env`로 격리하며, AI에게 코드를 넘기기 전 시크릿이 마스킹된 안전한 복사본을 만들어줍니다.

---

## ✨ 핵심 기능

- **🔍 AST 기반 정밀 검증 (Phase-Gate)**: 단순 정규식 탐지의 한계를 넘어 `web-tree-sitter` AST 분석 엔진을 통해 실제 코드의 문자열 리터럴 여부를 검증합니다. 주석이나 코드 외 영역의 오탐을 획기적으로 줄여줍니다. (iOS/Android/Flutter 우선 지원)
- **⚡ 하이브리드 I/O 최적화**: 파일 크기에 따라 `readFileSync`와 `readline` 인터페이스를 지능적으로 전환하며, 마스킹 시 `Stream.pipe()`를 활용하여 대규모 프로젝트에서도 메모리 점유율을 최소화합니다.
- **🛡️ 자동 환경 변수 변환 (Auto-fix)**: 탐지된 시크릿을 `.env`로 옮기고, 각 플랫폼(Dart/Kotlin/Swift/Obj-C/Java 등)에 맞는 환경 변수 참조 코드로 자동 교체합니다. 플러그인 아키텍처로 신규 플랫폼 확장이 용이합니다.
- **🔌 플러그인 기반 확장**: BasePlatform 클래스를 상속받아 새로운 언어/프레임워크를 지원할 수 있습니다. 규격화된 인터페이스를 통해 안전한 확장을 보장합니다.
- **📜 멀티라인 시크릿 탐지**: 일반적인 문자열뿐만 아니라 PEM Private Key, 인증서 등 여러 줄로 구성된 암호화 데이터까지 완벽하게 탐지하고 처리합니다.
- **📊 자동 리포트 & CI 지원**: 실행 시마다 `blinder_reports/`에 스캔 이력을 저장하며, `--ci` 또는 `-y` (yes) 모드를 통해 파이프라인에서 보안 사고를 원천 차단합니다.

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
# 저장소설치
npm install -g github:YellowC-137/Blinder
```

### 필수 명령어

#### 1. `blinder blind` (초기 설정)
프로젝트 내의 시크릿을 탐지하고 `.env`로 마이그레이션하여 프로젝트 보안 기초를 다집니다. `scan` + `protect` + `gitignore` 과정을 한 번에 수행합니다.
- **안전한 워크플로우**: 수정 전 대상 파일 목록을 보여주고 **추가적으로 제외할 폴더(사용자 지정 커스텀 라이브러리 등)**를 묻는 인터랙티브 단계를 제공합니다.
- `-y, --yes`: 모든 대화형 질문에 자동으로 '예'라고 답하며 CI/CD 파이프라인에서 사용하기 적합합니다.

#### 2. `blinder bridge` (빌드 시스템 연동)
생성된 `.env` 파일의 내용이 각 플랫폼의 빌드 시스템(Android `BuildConfig`, iOS `Info.plist`, Flutter `--dart-define` 등)에서 자동으로 인식되도록 설정을 자동화합니다. 플러그인별 `setupBridge()`가 호출됩니다.
- **Android**: `build.gradle`에 환경 변수 로딩 스크립트 자동 주입.
- **iOS (Native & Flutter)**: `Podfile`에 환경 변수 주입 훅(`post_install`) 자동 추가.
  - `pod install` 실행 시 Xcode 빌드 페이즈에 'Blinder Env Loader'가 자동으로 구성됩니다.
  - **🚨 Podfile이 없는 경우 (수동 설정 필수)**: `blinder-ios-setup.sh` 가이드에 따라 Xcode `Build Phases`에 직접 스크립트를 등록해야 합니다. 이때 **'Based on dependency analysis' 체크 해제**와 **'User Script Sandboxing'을 NO로 설정**하는 것이 필수입니다.
- **Flutter**: IDE(VS Code, IntelliJ) 실행 설정에 환경 변수 플래그 자동 추가.

#### 3. `blinder mask` (AI 전송 전)
AI 에이전트(Cursor 등)에게 프로젝트 전체의 맥락을 제공하면서도 시크릿은 유출되지 않도록 **마스킹된 프로젝트 복사본**을 생성합니다. 모든 시크릿은 `__BLINDER_VAR__` 태그로 치환됩니다.

#### 4. `blinder restore` (AI 작업 후)
AI 에이전트가 마스킹된 폴더에서 작업한 **모든 코드와 새 파일**을 원본 프로젝트로 안전하게 가져옵니다. 이때 마스킹되었던 시크릿은 자동으로 실제 값으로 복원됩니다.

#### 5. `blinder scan` (수동 스캔)
프로젝트 내의 시크릿을 수동으로 탐지하고 상세 리포트를 생성합니다.
- `--ci`: 시크릿 발견 시 빌드를 실패시켜 CI 파이프라인 보안 사고를 예방합니다.
- `-o <file>`: 스캔 결과를 특정 JSON 파일로 추출합니다.

#### 6. `blinder rollback` (원상 복구)
`blind`나 `protect`로 인해 적용된 소스코드의 마이그레이션(접근자 치환)을 취소하고, 하드코딩된 원본 상태로 되돌립니다. 생성된 보안 관련 파일들도 일괄 삭제할 수 있습니다.

#### 7. `blinder gitignore` (.gitignore 설정)
감지된 플랫폼에 맞춰 유출되기 쉬운 파일들과 Blinder 생성 파일을 `.gitignore`에 자동으로 추가합니다. 각 플러그인이 제공하는 템플릿이 자동 반영됩니다.

#### 8. `blinder help` (도움말)
사용 가능한 모든 명령어와 상세 옵션 설명을 터미널에 출력합니다.

---

## 🛠️ 프로젝트 설정 (`.blinderSettings`)

프로젝트 루트 폴더에 `.blinderSettings` 파일을 JSON 형식으로 생성하여 Blinder의 동작을 커스터마이징할 수 있습니다. 특히 외부 SDK나 보안 라이브러리가 포함된 경우, 이 설정을 통해 스캔 및 치환 대상에서 안전하게 제외할 수 있습니다.

### 설정 옵션
- `ignorePaths`: 스캔 및 Auto-fix에서 제외할 파일 또는 폴더 경로 (Glob 패턴 지원)
- `customPatterns`: 프로젝트 고유의 시크릿 패턴 추가 (Regex 지원)
- `maskOutput`: `blinder mask` 실행 시 결과물이 저장될 기본 폴더명

### 예시 (`.blinderSettings`)
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
> **지능형 자동 탐지 (Heuristic Protection)**: Blinder는 별도의 설정 없이도 파일 상단에 `Copyright`, `SDK`, `Third-party` 등의 문구가 포함된 파일은 외부 라이브러리로 인식하여 자동으로 보호합니다.

---

## 🔧 플랫폼별 Auto-fix 예시

| 플랫폼 | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS (Swift)** | `"glpat...789"` | `ProcessInfo.processInfo.environment["GITLAB_TOKEN"] ?? ""` |
| **iOS (Obj-C)** | `NSString *const API_URL = @"..."` | `#define API_URL [[NSBundle mainBundle] ...]` |

### ⚠️ 플랫폼별 Auto-fix 유의사항 (Caveats)

각 플랫폼별로 언어의 특성과 빌드 시스템에 따라 `blinder protect` (Auto-fix) 적용 시 반드시 알아두어야 할 주의사항이 있습니다. (`blinder mask`는 언어를 가리지 않고 단순 치환하므로 아래 제약과 무관하게 100% 완벽 동작합니다.)

#### 🍎 iOS (Objective-C)
* **전역 상수 마이그레이션**: `NSString *const` 형태의 전역 문자열 상수는 C언어 컴파일 타임 제약으로 인해 런타임 함수를 바로 사용할 수 없습니다.
* **Blinder의 처리**: Blinder는 해당 구문을 탐지하여 런타임에 값을 읽어오는 **매크로(`#define`)**로 자동 치환합니다.
* **주의**: `int`, `double`과 같은 원시 타입(Primitive Type) 상수는 현재 자동 치환 대상에서 제외되므로, 필요시 수동으로 처리하거나 문자열 상수로 변경하는 것을 권장합니다.

#### 🍏 iOS (Swift)
* Swift는 내부적으로 지연 초기화(Lazy Initialization)나 런타임 평가를 자체 지원하므로, 전역 변수나 정적 변수에 `Bundle.main.infoDictionary?...`가 주입되어도 문법 에러가 나지 않고 잘 동작합니다.
* **주의**: 치환된 변수가 실제 런타임에 값을 가지려면, 프로젝트의 `.xcconfig` 파일 및 `Info.plist`가 `.env`를 정상적으로 읽어오도록 수동으로 빌드 세팅을 연동해 주어야 합니다.

#### 🤖 Android (Kotlin / Java)
* **BuildConfig 연동**: Auto-fix는 하드코딩된 문자열을 `BuildConfig.VARIABLE_NAME` 으로 치환합니다.
* **주의**: 앱이 정상적으로 컴파일되려면 프로젝트의 `build.gradle` (또는 `build.gradle.kts`) 파일이 `.env` 파일을 읽어 BuildConfig 필드를 동적으로 생성해 주도록 gradle 스크립트를 세팅해야 합니다. 만약 적용하지 않으면 `Unresolved reference: BuildConfig` 에러가 발생합니다.
* 확장자가 `.xml` (예: `AndroidManifest.xml`)인 경우 `@string/VARIABLE_NAME`으로 치환되므로, `strings.xml` 기반 리소스 연결이 추가로 필요할 수 있습니다.

#### 🦋 Flutter (Dart)
* **dart-define 제약**: Dart 코드는 `String.fromEnvironment('VAR')` 형태로 치환됩니다.
* **주의**: 치환된 후 빌드 시 환경 변수 값을 주입하려면 반드시 실행/빌드 명령어에 `--dart-define-from-file=.env` 플래그를 명시해야 합니다. (예: `flutter run --dart-define-from-file=.env`) 이를 누락할 경우 시스템 환경 변수와 무관하게 모든 치환된 값이 빈 문자열(`""`)로 리턴됩니다.


---

## 🔌 신규 플랫폼 추가 가이드 (Plugin Architecture)

Blinder는 **플러그인 아키텍처**를 채택하여, 코어 엔진을 수정하지 않고도 새로운 언어/프레임워크를 손쉽게 지원할 수 있습니다.

### 가장 빠른 방법: CLI 자동 생성

```bash
blinder add_platform
```

대화형 프롬프트에 답하면 플러그인 파일 생성 + 레지스트리 등록이 **자동으로** 완료됩니다. 카테고리(Backend, Frontend, Mobile)를 선택하거나 **Custom**으로 직접 정의할 수도 있습니다. 자세한 내용은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

### 직접 작성하기: 최소 템플릿 (이것만 있으면 동작합니다!)

새로운 플랫폼을 추가하는 데 필요한 코드는 **단 몇 줄**입니다.

```javascript
// 예시: src/platforms/backend/python.js
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

`src/platforms/index.js`에 등록하면 끝:

```javascript
import python from './backend/python.js';   // ← 추가

export const platforms = [
  common, ios, android, flutter,
  python   // ← 추가
];
```

이것만으로 Blinder의 스캐닝, Auto-fix, .gitignore 생성이 Python 코드를 보호하기 시작합니다! 🎉

> [!TIP]
> `definePlatform()` 헬퍼가 `sensitiveFiles`, `ignorePaths`, `commentRegex` 등의 기본값을 자동으로 채워줍니다.

### 검증

```bash
blinder scan --path /your/python-project --dry-run
# → "Detected platforms: Common Environment, Python" 출력 확인

blinder blind --path /your/python-project --dry-run -y
# → os.environ.get("VAR_NAME") 치환 확인
```

<details>
<summary><strong>📖 고급 플러그인 API (Bridge, Advanced Fix, Lifecycle Hooks)</strong></summary>

#### 전체 IPlatform 인터페이스 규격

| 속성/메서드 | 타입 | 필수 | 설명 |
|:---|:---|:---:|:---|
| `id` | `string` | ✅ | 고유 식별자 (소문자, 영문) |
| `name` | `string` | ✅ | 사용자 표시용 이름 |
| `category` | `string` | ✅ | 카테고리 (`core`, `mobile`, `backend`, `web`) |
| `detect(repoPath)` | `async → bool` | ✅ | 프로젝트 유형 판별 |
| `commonExtensions` | `string[]` | ✅ | 스캔 대상 파일 확장자 |
| `sensitiveFiles` | `object[]` | | 민감 파일 정의 (`glob`, `severity`, `reason`) |
| `commentRegex` | `RegExp` | | 주석 행 판별 정규식 |
| `ignorePaths` | `string[]` | | 스캔 제외 경로 (Glob) |
| `getGitignoreTemplate()` | `→ string` | | .gitignore 섹션 내용 |
| `getAutoFixReplacement(match, envVarName, ext, options)` | `→ string` | | 환경 변수 접근자 코드 |
| `applyAdvancedFix(context)` | `→ object` | | 복잡한 소스 코드 변환 (Stage 1) |
| `preFix(context)` | `async` | | 파일 수정 전 훅 |
| `postFix(context)` | `async` | | 파일 수정 후 훅 |
| `setupBridge(repoPath)` | `async` | | 빌드 시스템 .env 연동 |
| `teardownBridge(repoPath)` | `async` | | 빌드 시스템 .env 연동 해제 |
| `testCases` | `object[]` | | 유효성 검증 테스트 케이스 |

#### 라이프사이클 실행 순서

```text
┌─────────────────────────────────────────────────┐
│ protect.js: applyAutoFixes()                    │
│                                                 │
│  for each file:                                 │
│    1. preFix()          ← 파일 수정 전 준비     │
│    2. for each secret:                          │
│       a. applyAdvancedFix()  ← Stage 1 (고급)  │
│       b. getAutoFixReplacement() ← Stage 2     │
│    3. postFix()         ← 파일 수정 후 후처리   │
└─────────────────────────────────────────────────┘
```

#### 고급 속성 예시 (Spring Boot)

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

  // 민감 파일 정의
  sensitiveFiles: [
    { glob: '**/application-secret.yml', severity: 'CRITICAL', reason: '프로덕션 DB/API 키' },
    { glob: '**/application-prod.properties', severity: 'HIGH', reason: '프로덕션 환경 설정' }
  ],

  // 스캔 제외 경로
  ignorePaths: ['**/target/**', '**/.mvn/**', '**/build/**'],

  // .gitignore 섹션
  getGitignoreTemplate: () => `
# Spring Boot
target/
*.jar
*.war
application-secret.yml
`,

  // 확장자별 접근자 분기
  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.java') return `System.getenv("${envVarName}")`;
    if (ext === '.properties' || ext === '.yml') return `\${${envVarName}}`;
    return `process.env.${envVarName}`;
  }
});
```

</details>

---

## 주의사항

> [!CAUTION]
> **빌드 설정 파일 수정**: Blinder의 `blind` (Auto-fix) 및 `bridge` 기능은 프로젝트의 핵심 빌드 파일(`build.gradle`, `.pbxproj`, `Info.plist` 등)을 직접 수정합니다. 실행 전 반드시 모든 변경 사항을 **Git에 커밋**하여 복구가 가능한 상태를 유지하세요.

> [!IMPORTANT]
> **Auto-fix 전 백업 필수**: Blinder는 실제 소스 코드를 수정합니다. `git commit`이 완료된 상태에서 실행하여 변경 사항을 쉽게 검토하세요.

> [!WARNING]
> **.env 파일 관리**: Blinder가 `.gitignore`에 자동으로 `.env`를 추가하지만, 항상 최종 커밋 전 `.env`가 Git에 포함되지 않았는지 수동으로 확인하는 습관을 권장합니다.
