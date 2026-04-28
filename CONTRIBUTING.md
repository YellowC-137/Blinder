# Contributing to Blinder 🛡️

[🇰🇷 한국어](#한국어-기여-가이드) | [🇺🇸 English](#english-contribution-guide)

---

## English Contribution Guide

Thanks for your interest in contributing. PRs welcome for new platforms, bug fixes, docs.

This guide walks you through adding a brand-new platform plugin (e.g. Ruby, Django, Go) **end-to-end** — from scaffolding to merging.

---

### 🗺️ Big Picture: What Is a "Platform Plugin"?

Blinder treats each language/framework as a **plugin**. A plugin tells the core engine:
- **How to detect** if a project belongs to this platform (`detect()`).
- **Which file extensions** to scan (`commonExtensions`).
- **How to rewrite a hardcoded secret** to an env-variable accessor (`getAutoFixReplacement()`).
- **(Optional)** How to wire `.env` into the build system (`setupBridge()`), how to handle complex AST rewrites (`applyAdvancedFix()`), and so on.

The core engine never hard-codes language rules. Add a plugin file, register it in `index.js`, done.

```text
src/platforms/
├── BasePlatform.js          ← class wrapper (don't touch)
├── definePlatform.js        ← helper that validates + wraps your config
├── index.js                 ← registry — every plugin imported here
├── common.js                ← cross-platform rules
├── mobile/
│   ├── ios.js
│   ├── android.js
│   └── flutter.js
└── backend/
    └── ruby.js              ← example you can copy
```

---

### 🛠️ Step-by-Step: Add a New Platform (Recommended Path)

#### Step 1 — Run the scaffolder

```bash
blinder add_platform
# or via npm script
npm run add-platform
```

The scaffolder is interactive. Here's a real session for adding **Django**:

```text
? Platform ID (lowercase letters, e.g. ruby, django):  django
? Platform name (display, e.g. Ruby on Rails):         Django
? Choose a Category:
  ❯ 1. Backend
    2. Frontend
    3. Mobile
    4. Custom
? Scan extensions (comma-separated, e.g. .rb,.yml):   .py,.html
? Project detection file (e.g. Gemfile, pom.xml):     manage.py

✓ Plugin file created: platforms/backend/django.js
✓ Registered: platforms/index.js

🚀 Next steps:
  1. Tweak detect() in the generated file if needed.
  2. Verify getAutoFixReplacement() output.
  3. Test: blinder scan --path /your/project --dry-run
```

#### What you'll be prompted for

| Prompt | Meaning | Examples | Validation |
|---|---|---|---|
| **Platform ID** | Internal identifier — also the filename | `ruby`, `django`, `nextjs` | lowercase + digits + `_`, must start with letter |
| **Platform name** | Human-readable display | `Ruby on Rails`, `Next.js` | non-empty |
| **Category** | Folder under `src/platforms/` | Backend / Frontend / Mobile / Custom | choose from list |
| **(Custom only) Category name** | Custom folder name | `infrastructure`, `desktop` | same rules as ID |
| **Scan extensions** | File extensions to read | `.rb,.erb`, `.py,.html`, `.go` | comma-separated, at least one |
| **Project detection file** | Marker file for `detect()` | `Gemfile`, `manage.py`, `go.mod` | non-empty |

#### Step 2 — What gets generated

The scaffolder picks an env-accessor based on your **first extension**:

| First extension | Generated accessor |
|---|---|
| `.py` | `os.environ.get("VAR")` |
| `.rb` | `ENV["VAR"]` |
| `.java`, `.kt` | `System.getenv("VAR")` |
| `.go` | `os.Getenv("VAR")` |
| `.rs` | `std::env::var("VAR").unwrap_or_default()` |
| `.php` | `getenv('VAR')` |
| anything else | `process.env.VAR` (Node.js fallback) |

Generated `src/platforms/backend/django.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'django',
  name: 'Django',
  category: 'backend',

  // Project detection: treat as Django if manage.py exists
  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'manage.py'));
  },

  // Extensions to scan
  commonExtensions: ['.py', '.html'],

  // Env-variable accessor codegen
  getAutoFixReplacement: (match, envVarName, ext, options) => {
    return `os.environ.get("${envVarName}")`;
  }
});
```

And `src/platforms/index.js` is auto-edited:

```javascript
import common from './common.js';
import ios from './mobile/ios.js';
import android from './mobile/android.js';
import flutter from './mobile/flutter.js';
import ruby from './backend/ruby.js';
import django from './backend/django.js';   // ← added

export const platforms = [
  common,
  ios,
  android,
  flutter,
  ruby,
  django                                     // ← added
];
```

#### Step 3 — Verify it works

```bash
# (a) Make sure the registry parses
node -e "import('./src/platforms/index.js').then(m => console.log(m.platforms.map(p => p.id)))"
# Should print: [ 'common', 'ios', 'android', 'flutter', 'ruby', 'django' ]

# (b) Project detection
blinder scan --path /path/to/django-project --dry-run
# Look for: "Detected platforms: ..., Django"

# (c) Auto-fix preview
blinder blind --path /path/to/django-project --dry-run -y
# Look for: hardcoded "abc123" → os.environ.get("MY_KEY")
```

#### Step 4 — Tweak if needed

The scaffolded plugin is intentionally minimal. Common things to refine:

- **Smarter `detect()`** — if your platform has multiple marker files, use OR:
  ```javascript
  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'manage.py')) ||
           fs.existsSync(path.join(repoPath, 'pyproject.toml'));
  }
  ```
- **Different accessor per extension** — `.py` vs templates:
  ```javascript
  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.html') return `{{ ${envVarName} }}`;
    return `os.environ.get("${envVarName}")`;
  }
  ```
- **Sensitive files always flagged** regardless of contents:
  ```javascript
  sensitiveFiles: [
    { glob: '**/local_settings.py', severity: 'CRITICAL', reason: 'Django local secrets' }
  ]
  ```
- **`.gitignore` template** appended by `blinder gitignore`:
  ```javascript
  getGitignoreTemplate: () => `\n# Django\n*.pyc\n__pycache__/\n.env\nlocal_settings.py\n`
  ```
- **Ignore vendored / generated dirs**:
  ```javascript
  ignorePaths: ['**/migrations/**', '**/static/admin/**', '**/venv/**']
  ```

---

### 📚 Full IPlatform Interface (Reference)

| Property / Method | Type | Required | Purpose |
|:---|:---|:---:|:---|
| `id` | `string` | ✅ | Unique identifier (lowercase, `_` allowed) |
| `name` | `string` | ✅ | Display name |
| `category` | `string` | | `core` / `mobile` / `backend` / `web` / `frontend` / custom (default `custom`) |
| `astLanguage` | `string` | | AST engine ID (`swift`, `objc`, ...) — opts into AST-based string-literal verification |
| `detect(repoPath)` | `async → bool` | ✅ | Project type detection |
| `commonExtensions` | `string[]` | ✅ | Extensions to scan |
| `sensitiveFiles` | `{ glob, severity, reason }[]` | | Files always flagged (creds, keystores) |
| `commentRegex` | `RegExp` | | Comment-line detector (default `/^\s*(\/\/|\/\*|\*|#)/`) |
| `ignorePaths` | `string[]` | | Glob excludes |
| `getGitignoreTemplate()` | `→ string` | | Section appended by `blinder gitignore` |
| `getAutoFixReplacement(match, envVarName, ext, options)` | `→ string` | | Env-accessor codegen (Stage 2 / fallback) |
| `applyAdvancedFix(context)` | `async → { handled, ... }` | | Stage 1 — complex AST-aware transforms |
| `preFix(context)` | `async` | | Pre-modification hook |
| `postFix(context)` | `async` | | Post-modification hook |
| `setupBridge(repoPath)` | `async` | | Wire `.env` into build system |
| `teardownBridge(repoPath)` | `async` | | Reverse `setupBridge` |
| `testCases` | `object[]` | | Validation cases (used by `test:integration`) |

#### Lifecycle (per file, inside `protect.js applyAutoFixes()`)

```text
preFix(context)
  for each detected secret:
    applyAdvancedFix(context)     ← Stage 1
                                     if returns { handled: true } → skip Stage 2
    getAutoFixReplacement(...)    ← Stage 2 (default path)
postFix(context)
```

`applyAdvancedFix()` is for cases simple substitution can't handle — e.g. Obj-C `NSString *const FOO = @"..."` must become a `#define` macro because C const-init can't call runtime functions. Most plugins won't need it.

---

### 🔐 Structured Config Files (Info.plist / AndroidManifest / .properties / .xcconfig)

For key/value config files, **don't** match raw strings. The scanner already routes them through dedicated parsers (`src/detectors/parsers/*`) and gates auto-fix via `src/protectors/keyClassifier.js`.

Default policy is **deny** — keys outside the whitelist are detected and warned but never rewritten.

To extend safe-fix coverage for your platform:
1. Add a parser if the file format is new (e.g. `.toml`, `.hcl`).
2. Add classifier rules in `keyClassifier.js`:
   - **Whitelist** (auto-fix allowed): SDK keys, public app IDs, anything matching `*_API_KEY` / `TOKEN` / `SECRET` style.
   - **Blacklist** (never auto-fixed): system/build keys (`CFBundle*`, `androidx.*`, `org.gradle.*`).

---

### 🔌 Bridge Integration (for compiled languages)

If your auto-fixed code requires build-time wiring (`BuildConfig`, `--dart-define`, `Info.plist` substitution), implement `setupBridge()` to inject the wiring **idempotently**, and pair with `teardownBridge()` so `rollback` fully reverts.

Reference implementations:
- `src/platforms/mobile/android.js` — BuildConfig + manifestPlaceholders injection into `app/build.gradle`.
- `src/platforms/mobile/ios.js` — Podfile `post_install` hook + Run Script Phase.
- `src/platforms/mobile/flutter.js` — `--dart-define-from-file=.env` in IDE configs + `f.sh` wrapper.

Idempotent = running `setupBridge()` twice should not double-inject. Always check for existing markers first (e.g. `// BLINDER_BRIDGE_BEGIN`).

---

### ✅ Testing Your Plugin

```bash
# 1. Unit + parser + classifier tests
npm test

# 2. Platform detection
blinder scan --path /path/to/test-project --dry-run

# 3. Auto-fix preview (no writes)
blinder blind --path /path/to/test-project --dry-run -y

# 4. Sample build regression (only if test/regression/<platform>/sample-app exists)
npm run test:regression:ios
npm run test:regression:android
npm run test:regression:flutter
```

PRs touching auto-fix should:
- Add/update entries in `test/key_classifier_test.js` / `test/parser_test.js`.
- Where applicable, add a sample project under `test/regression/<platform>/sample-app/`.

---

### 🐛 Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `Platform plugin must have an "id" property.` at load | `definePlatform()` sees missing required field | Add `id` / `name` / `detect` / `commonExtensions` |
| Plugin file created but not active | Forgot to register in `index.js` | Re-run scaffolder, or add `import` + array entry manually |
| `Detected platforms` doesn't include yours | `detect()` returned false | Check the marker file path; `detect` runs against the **repo root**, not subdirectories |
| Auto-fix replaces secrets in comments | `commentRegex` doesn't match your syntax | Override `commentRegex` (default catches `//`, `/*`, `*`, `#`) |
| Build breaks after `blind` | Auto-fixed code needs runtime wiring | Implement `setupBridge()` |
| `rollback` leaves leftover bridge code | `teardownBridge()` not implemented | Pair every `setupBridge()` with a `teardownBridge()` |

---

## 한국어 기여 가이드

Blinder 기여 환영. 신규 플랫폼, 버그 수정, 문서 모두 PR 가능.

이 가이드는 신규 플랫폼 플러그인(예: Ruby, Django, Go) 추가를 **처음부터 끝까지** 따라가는 친절한 안내서.

---

### 🗺️ 큰 그림: "플랫폼 플러그인"이란?

Blinder는 각 언어/프레임워크를 **플러그인**으로 다룸. 플러그인은 코어 엔진에 다음을 알려줌:
- **프로젝트 감지** 로직 (`detect()`)
- **스캔 대상 확장자** (`commonExtensions`)
- **하드코딩 시크릿 → 환경변수 접근자**로 바꾸는 규칙 (`getAutoFixReplacement()`)
- **(선택)** `.env`를 빌드 시스템에 연동하는 방법 (`setupBridge()`), 복잡 AST 변환 (`applyAdvancedFix()`) 등

코어 엔진은 언어 규칙을 절대 하드코딩하지 않음. 플러그인 파일 추가 + `index.js` 등록만 하면 끝.

```text
src/platforms/
├── BasePlatform.js          ← 클래스 래퍼 (수정 X)
├── definePlatform.js        ← 검증 + 래핑 헬퍼
├── index.js                 ← 레지스트리 — 모든 플러그인 import
├── common.js                ← 공통 규칙
├── mobile/
│   ├── ios.js
│   ├── android.js
│   └── flutter.js
└── backend/
    └── ruby.js              ← 복사해서 시작 가능한 예시
```

---

### 🛠️ 단계별 가이드: 신규 플랫폼 추가 (권장 경로)

#### 1단계 — 스캐폴더 실행

```bash
blinder add_platform
# 또는 npm 스크립트
npm run add-platform
```

대화형 진행. **Django** 추가 실제 세션 예시:

```text
? Platform ID (소문자, 영문. 예: ruby, django):       django
? Platform 이름 (사용자 표시용. 예: Ruby on Rails):    Django
? Category를 선택하세요:
  ❯ 1. Backend
    2. Frontend
    3. Mobile
    4. Custom
? 스캔할 파일 확장자 (콤마 구분. 예: .rb,.yml):       .py,.html
? 프로젝트 감지 파일 (예: Gemfile, pom.xml):           manage.py

✓ 플러그인 파일 생성: platforms/backend/django.js
✓ 레지스트리 등록: platforms/index.js

🚀 다음 단계:
  1. 생성된 파일의 detect() 로직을 프로젝트에 맞게 수정.
  2. getAutoFixReplacement() 치환 코드 확인.
  3. 테스트: blinder scan --path /your/project --dry-run
```

#### 입력 항목 상세

| 프롬프트 | 의미 | 예시 | 검증 규칙 |
|---|---|---|---|
| **Platform ID** | 내부 식별자 + 파일명 | `ruby`, `django`, `nextjs` | 소문자 + 숫자 + `_`, 첫 글자는 영문 |
| **Platform 이름** | 사용자 표시명 | `Ruby on Rails`, `Next.js` | 비어있으면 안됨 |
| **Category** | `src/platforms/` 하위 폴더 | Backend / Frontend / Mobile / Custom | 리스트에서 선택 |
| **(Custom 선택 시) Category 이름** | 사용자 정의 폴더명 | `infrastructure`, `desktop` | ID와 동일 규칙 |
| **스캔 확장자** | 읽을 파일 확장자 | `.rb,.erb`, `.py,.html`, `.go` | 콤마 구분, 최소 1개 |
| **프로젝트 감지 파일** | `detect()` 마커 파일 | `Gemfile`, `manage.py`, `go.mod` | 비어있으면 안됨 |

#### 2단계 — 무엇이 생성되는가

스캐폴더는 **첫 번째 확장자** 기준으로 env 접근자 자동 선택:

| 첫 확장자 | 생성되는 접근자 |
|---|---|
| `.py` | `os.environ.get("VAR")` |
| `.rb` | `ENV["VAR"]` |
| `.java`, `.kt` | `System.getenv("VAR")` |
| `.go` | `os.Getenv("VAR")` |
| `.rs` | `std::env::var("VAR").unwrap_or_default()` |
| `.php` | `getenv('VAR')` |
| 그 외 | `process.env.VAR` (Node.js fallback) |

생성된 `src/platforms/backend/django.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'django',
  name: 'Django',
  category: 'backend',

  // 프로젝트 감지: manage.py가 있으면 Django 프로젝트로 인식
  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'manage.py'));
  },

  // 스캔 대상 확장자
  commonExtensions: ['.py', '.html'],

  // 환경 변수 접근자 코드 생성
  getAutoFixReplacement: (match, envVarName, ext, options) => {
    return `os.environ.get("${envVarName}")`;
  }
});
```

`src/platforms/index.js`도 자동 편집됨:

```javascript
import common from './common.js';
import ios from './mobile/ios.js';
import android from './mobile/android.js';
import flutter from './mobile/flutter.js';
import ruby from './backend/ruby.js';
import django from './backend/django.js';   // ← 자동 추가

export const platforms = [
  common,
  ios,
  android,
  flutter,
  ruby,
  django                                     // ← 자동 추가
];
```

#### 3단계 — 동작 확인

```bash
# (a) 레지스트리 파싱 확인
node -e "import('./src/platforms/index.js').then(m => console.log(m.platforms.map(p => p.id)))"
# 출력: [ 'common', 'ios', 'android', 'flutter', 'ruby', 'django' ]

# (b) 프로젝트 감지
blinder scan --path /path/to/django-project --dry-run
# "Detected platforms: ..., Django" 확인

# (c) Auto-fix 미리보기
blinder blind --path /path/to/django-project --dry-run -y
# 하드코딩된 "abc123" → os.environ.get("MY_KEY") 변환 확인
```

#### 4단계 — 필요하면 다듬기

스캐폴더는 일부러 최소 형태만 만듦. 자주 다듬는 부분:

- **더 똑똑한 `detect()`** — 마커 파일이 여러 개면 OR:
  ```javascript
  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'manage.py')) ||
           fs.existsSync(path.join(repoPath, 'pyproject.toml'));
  }
  ```
- **확장자별 다른 접근자** — `.py`와 템플릿 분기:
  ```javascript
  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.html') return `{{ ${envVarName} }}`;
    return `os.environ.get("${envVarName}")`;
  }
  ```
- **민감 파일 항상 플래그**:
  ```javascript
  sensitiveFiles: [
    { glob: '**/local_settings.py', severity: 'CRITICAL', reason: 'Django 로컬 시크릿' }
  ]
  ```
- **`.gitignore` 템플릿** (`blinder gitignore`가 추가):
  ```javascript
  getGitignoreTemplate: () => `\n# Django\n*.pyc\n__pycache__/\n.env\nlocal_settings.py\n`
  ```
- **벤더/생성 디렉토리 제외**:
  ```javascript
  ignorePaths: ['**/migrations/**', '**/static/admin/**', '**/venv/**']
  ```

---

### 📚 전체 IPlatform 인터페이스 (레퍼런스)

| 속성/메서드 | 타입 | 필수 | 용도 |
|:---|:---|:---:|:---|
| `id` | `string` | ✅ | 고유 식별자 (소문자, `_` 허용) |
| `name` | `string` | ✅ | 표시명 |
| `category` | `string` | | `core` / `mobile` / `backend` / `web` / `frontend` / 사용자정의 (기본 `custom`) |
| `astLanguage` | `string` | | AST 엔진 ID (`swift`, `objc` 등) — AST 기반 문자열 리터럴 검증 활성화 |
| `detect(repoPath)` | `async → bool` | ✅ | 프로젝트 유형 판별 |
| `commonExtensions` | `string[]` | ✅ | 스캔 대상 확장자 |
| `sensitiveFiles` | `{ glob, severity, reason }[]` | | 항상 플래그할 파일 (자격증명, keystore) |
| `commentRegex` | `RegExp` | | 주석행 판별 (기본 `/^\s*(\/\/|\/\*|\*|#)/`) |
| `ignorePaths` | `string[]` | | Glob 제외 |
| `getGitignoreTemplate()` | `→ string` | | `blinder gitignore`가 추가할 섹션 |
| `getAutoFixReplacement(match, envVarName, ext, options)` | `→ string` | | env 접근자 코드 생성 (Stage 2 / fallback) |
| `applyAdvancedFix(context)` | `async → { handled, ... }` | | Stage 1 — AST 기반 복잡 변환 |
| `preFix(context)` | `async` | | 수정 전 훅 |
| `postFix(context)` | `async` | | 수정 후 훅 |
| `setupBridge(repoPath)` | `async` | | 빌드 시스템에 `.env` 연동 |
| `teardownBridge(repoPath)` | `async` | | `setupBridge` 역연산 |
| `testCases` | `object[]` | | 검증 케이스 (`test:integration`에서 사용) |

#### 라이프사이클 (파일 단위, `protect.js applyAutoFixes()` 내부)

```text
preFix(context)
  for each detected secret:
    applyAdvancedFix(context)     ← Stage 1
                                     { handled: true } 반환 시 Stage 2 스킵
    getAutoFixReplacement(...)    ← Stage 2 (기본 경로)
postFix(context)
```

`applyAdvancedFix()`는 단순 치환으로 안 되는 경우용 — 예: Obj-C `NSString *const FOO = @"..."`는 C const-init이 런타임 함수 호출 불가라 `#define` 매크로로 바꿔야 함. 대부분 플러그인은 필요 없음.

---

### 🔐 구조화 설정 파일 (Info.plist / AndroidManifest / .properties / .xcconfig)

키/값 구조 파일은 **raw 문자열로 매칭하지 말 것**. 스캐너가 이미 전용 파서(`src/detectors/parsers/*`)로 라우팅하고 `src/protectors/keyClassifier.js`로 자동치환을 게이팅함.

기본 정책은 **default-deny** — 화이트리스트 외 키는 검출/경고만 발생하고 절대 자동치환되지 않음.

플랫폼별 안전 자동치환 범위 확장 방법:
1. 새 파일 형식이면 (예: `.toml`, `.hcl`) 파서 추가.
2. `keyClassifier.js`에 분류 규칙 추가:
   - **Whitelist** (자동치환 허용): SDK 키, 공개 App ID, `*_API_KEY` / `TOKEN` / `SECRET` 패턴.
   - **Blacklist** (자동치환 영구 차단): 시스템/빌드 키 (`CFBundle*`, `androidx.*`, `org.gradle.*`).

---

### 🔌 Bridge 연동 (컴파일 언어용)

자동치환된 코드가 빌드 타임 연동을 요구하면 (`BuildConfig`, `--dart-define`, `Info.plist` 치환 등) `setupBridge()`를 **멱등하게** 구현. `rollback`이 완전 되돌리도록 `teardownBridge()` 짝으로 작성.

레퍼런스 구현:
- `src/platforms/mobile/android.js` — `app/build.gradle`에 BuildConfig + manifestPlaceholders 주입.
- `src/platforms/mobile/ios.js` — Podfile `post_install` 훅 + Run Script Phase.
- `src/platforms/mobile/flutter.js` — IDE 설정에 `--dart-define-from-file=.env` + `f.sh` 래퍼 생성.

멱등 = `setupBridge()` 두 번 실행해도 중복 주입 X. 항상 기존 마커 확인 후 주입 (예: `// BLINDER_BRIDGE_BEGIN`).

---

### ✅ 플러그인 검증

```bash
# 1. 유닛 + 파서 + 분류기 테스트
npm test

# 2. 플랫폼 감지
blinder scan --path /path/to/test-project --dry-run

# 3. Auto-fix 미리보기 (쓰기 없음)
blinder blind --path /path/to/test-project --dry-run -y

# 4. 샘플 빌드 회귀 (test/regression/<platform>/sample-app 존재 시)
npm run test:regression:ios
npm run test:regression:android
npm run test:regression:flutter
```

자동치환 변경 PR은:
- `test/key_classifier_test.js` / `test/parser_test.js` 항목 추가/갱신.
- 가능하면 `test/regression/<platform>/sample-app/`에 샘플 프로젝트 추가.

---

### 🐛 자주 만나는 함정

| 증상 | 원인 | 해결 |
|---|---|---|
| 로드 시 `Platform plugin must have an "id" property.` | `definePlatform()`이 필수 필드 누락 감지 | `id` / `name` / `detect` / `commonExtensions` 추가 |
| 파일은 만들어졌는데 동작 안함 | `index.js`에 등록 누락 | 스캐폴더 재실행 또는 수동으로 import + 배열 추가 |
| `Detected platforms`에 안 나타남 | `detect()`가 false 반환 | 마커 파일 경로 확인. `detect`는 **repo 루트** 기준, 하위 디렉토리 X |
| 주석 안의 시크릿까지 치환 | `commentRegex` 미일치 | `commentRegex` 오버라이드 (기본은 `//`, `/*`, `*`, `#` 잡음) |
| `blind` 후 빌드 깨짐 | 자동치환된 코드가 런타임 연동 필요 | `setupBridge()` 구현 |
| `rollback` 후 brige 코드 잔존 | `teardownBridge()` 미구현 | 모든 `setupBridge()`는 `teardownBridge()` 짝 필수 |
