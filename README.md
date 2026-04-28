<div align="center">

# Blinder 🛡️

**AI 시대의 시크릿 보호 자동화 — 코드는 그대로, 시크릿만 사라지게.**

[🇰🇷 한국어](./README.md) · [🇺🇸 English](./README_en.md) · [기여 가이드](./CONTRIBUTING.md)

[![Node.js](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Flutter%20%7C%20Node%20%7C%20Spring%20%7C%20React%20%7C%20Ruby-orange.svg)](#-지원-플랫폼--언어)
[![Plugin Architecture](https://img.shields.io/badge/architecture-plugin--based-purple.svg)](#-신규-플랫폼-추가-가이드-plugin-architecture)
[![CI Ready](https://img.shields.io/badge/CI-ready-success.svg)](#-그룹-c-보조-명령)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

> **Blinder**는 Cursor / ChatGPT / Claude 같은 AI 에이전트에 코드를 넘기기 전, 소스 속 하드코딩된 API 키·자격증명·인증서가 외부로 유출되는 것을 사전 차단합니다.
>
> 모바일(iOS·Android·Flutter)부터 백엔드(Spring Boot·Node.js·Java·Ruby), 프론트엔드(React/CRA/Vite/Next.js)까지 — **플러그인 아키텍처**로 모든 플랫폼을 커버하며, 두 가지 워크플로(`blind`로 운영용 분리, `mask`로 AI 공유용 사본)로 안전하게 처리합니다.

---

## 📑 목차

- [왜 Blinder인가?](#-왜-blinder인가)
- [60초 퀵스타트](#-60초-퀵스타트)
- [지원 플랫폼 / 언어](#-지원-플랫폼--언어)
- [핵심 기능](#-핵심-기능)
- [설치](#-설치)
- [두 워크플로 비교](#-두-워크플로-비교)
- [명령어 가이드](#-명령어-가이드)
- [프로젝트 설정 (`.blinderSettings`)](#%EF%B8%8F-프로젝트-설정-blindersettings)
- [플랫폼별 Auto-fix 예시](#-플랫폼별-auto-fix-예시-blind-워크플로)
- [다른 도구와 비교](#-다른-도구와-비교)
- [FAQ](#-faq-자주-묻는-질문)
- [로드맵](#-로드맵)
- [신규 플랫폼 추가 가이드](#-신규-플랫폼-추가-가이드-plugin-architecture)
- [공통 주의사항](#-공통-주의사항)
- [기여하기 · 라이선스 · 감사](#-기여하기--라이선스--감사)

---

## 🤔 왜 Blinder인가?

AI 코딩 에이전트가 일상이 된 지금, 가장 흔한 사고 시나리오는 다음과 같습니다.

| 위험 시나리오 | Blinder가 해결하는 방식 |
|---|---|
| 🪣 **`.env`만 빼고 폴더 공유** — 그러나 소스 속 하드코딩 키가 그대로 노출 | `blind`가 소스의 평문 키를 `.env`로 분리 + env 접근자로 자동 치환 |
| 🤖 **AI에게 "리팩터링해줘"** — 답변에 키 일부가 그대로 인용되어 외부 학습 데이터로 흘러감 | `mask`가 모든 시크릿을 `__BLINDER_VAR__` 토큰으로 치환한 **읽기 전용 사본** 생성 |
| 🧨 **빌드 깨짐 우려** — 키를 `.env`로 옮기면 `BuildConfig`/`Info.plist`/`dart-define` 연동을 다 손봐야 함 | `bridge`가 플랫폼별 빌드 시스템 연동을 멱등하게 자동 주입 |
| 🔁 **AI 수정안을 원본에 머지** — 토큰을 다시 시크릿으로 돌리는 작업이 수동/위험 | `restore`가 `.blinder_map.json` 기반으로 자동 복원 + import 누락 보정 |
| 🚨 **CI/CD에서 사고 차단** — git pre-commit / pipeline에 통합하고 싶음 | `scan --ci` 비-0 종료 코드로 파이프라인 게이팅 |

**한 줄 요약**: 시크릿 탐지(scan) + 운영용 안전 분리(blind/bridge/rollback) + AI 공유용 마스킹(mask/restore)을 **하나의 CLI**로 묶었습니다.

---

## ⚡ 60초 퀵스타트

```bash
# 1) 설치
npm install -g github:YellowC-137/Blinder

# 2) 프로젝트 디렉토리로 이동
cd /path/to/your/project

# 3) 안전하게 미리보기 (파일 수정 없음)
blinder scan --dry-run

# 4-A) 운영용: 시크릿을 .env로 분리하고 빌드 시스템 연동
blinder blind            # 소스 자동 치환 + .env 생성 + .gitignore 보강
blinder bridge           # BuildConfig / Podfile / dart-define 등 빌드 연동

# 4-B) 또는 AI 공유용: 마스킹된 읽기 전용 사본 생성
blinder mask             # maskedProject_<projectName>/ 생성

# 5) 사고 발생 시 되돌리기
blinder rollback         # blind 결과를 하드코딩 원상복구
blinder restore          # AI가 수정한 mask 사본을 원본에 머지 + 토큰 자동 복원
```

> [!IMPORTANT]
> 어떤 명령이든 실행 **전에 반드시 `git commit`**. Blinder는 빌드 핵심 파일(`build.gradle`, `Podfile`, `Info.plist`, `.pbxproj`)까지 수정합니다.

---

## 🧩 지원 플랫폼 / 언어


| 플랫폼 | 카테고리 | 감지 파일 | 스캔 확장자 | 상태 |
|---|---|---|---|:---:|
| **iOS** (Swift / Obj-C) | mobile | `*.xcodeproj`, `Podfile`, `Package.swift` | `.swift`, `.m`, `.h`, `.mm`, `.plist`, `.xcconfig` | ✅ Stable |
| **Android** (Kotlin / Java) | mobile | `build.gradle`, `AndroidManifest.xml` | `.kt`, `.java`, `.xml`, `.gradle`, `.properties`, `.json` | ✅ Stable |
| **Flutter** (Dart) | mobile | `pubspec.yaml` | `.dart`, `.yaml` | ✅ Stable |
| **Common** (cross-platform) | core | (모든 프로젝트) | `.env`, `.json` | ✅ Stable |
| **Node.js** | backend | `package.json` (frontend deps 없음) | `.js`, `.mjs`, `.cjs`, `.ts` | ✅ Stable |
| **Java** | backend | `pom.xml` 또는 `build.gradle` (Spring/Android 제외) 또는 `src/main/java/` | `.java`, `.properties`, `.xml` | ✅ Stable |
| **Spring Boot** | backend | `pom.xml`(spring-boot-starter) 또는 `build.gradle`(`org.springframework.boot`) | `.java`, `.kt`, `.properties`, `.yml`, `.yaml`, `.xml` | ✅ Stable |
| **React** (CRA / Vite / Next.js) | frontend | `package.json` (`react` deps) | `.js`, `.jsx`, `.ts`, `.tsx` | ✅ Stable |
| **Ruby** | backend | `Gemfile` | `.rb` | ✅ 배포완료 |

**구조화 파일 자동치환** (default-deny + 화이트리스트 게이팅): Info.plist · AndroidManifest meta-data · `gradle.properties` · `local.properties`(영구차단) · `.xcconfig`(영구차단)

> 신규 플랫폼 추가는 [신규 플랫폼 추가 가이드](#-신규-플랫폼-추가-가이드-plugin-architecture) 또는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

---

## ✨ 핵심 기능

- **🔍 AST 기반 정밀 검증 (Phase-Gate)**: `web-tree-sitter` AST 분석으로 실제 문자열 리터럴 여부를 검증하여 주석/코드 외 영역 오탐을 최소화. (iOS/Android/Flutter 우선 지원)
- **⚡ 하이브리드 I/O**: 파일 크기에 따라 `readFileSync`와 `readline` 스트림을 전환. 대용량 프로젝트에서도 메모리 점유율 최소.
- **🛡️ 자동 환경변수 변환 (Auto-fix)**: 탐지된 시크릿을 `.env`로 옮기고 플랫폼별(Dart/Kotlin/Swift/Obj-C/Java) 환경변수 접근 코드로 자동 치환.
- **🔌 플러그인 아키텍처**: `BasePlatform` 상속으로 신규 언어/프레임워크 손쉽게 추가. 코어 엔진은 언어 규칙을 모릅니다.
- **🌉 Bridge 자동 연동**: BuildConfig·Podfile post_install·dart-define-from-file 등 빌드 시스템 wiring을 멱등하게 주입/회수.
- **📜 멀티라인 시크릿 탐지**: 일반 문자열뿐만 아니라 PEM Private Key, 인증서 등 여러 줄 데이터까지 처리.
- **📊 자동 리포트 & CI 지원**: `blinder_reports/`에 스캔 이력 저장. `--ci` / `-y` 모드로 파이프라인 통합.
- **🗝️ 구조화 파일 검출 + 화이트리스트**: Info.plist, AndroidManifest meta-data, gradle.properties 등을 키 단위로 파싱하고, SDK 키만 자동치환 대상으로 분류 (시스템 키 자동 제외).

---

## 📦 설치

### 옵션 1 — 글로벌 설치 (권장)

```bash
npm install -g github:YellowC-137/Blinder
blinder --version
```

### 옵션 2 — 소스 클론 + npm link (개발/기여용)

```bash
git clone https://github.com/YellowC-137/Blinder.git
cd Blinder
npm install
sudo npm link
```

### 요구 사항
- Node.js **18 이상**
- macOS / Linux / Windows (PowerShell)
- iOS Bridge를 사용하려면 macOS + Xcode 14+ 권장

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

#### C-3. `blinder add_platform` — 신규 플랫폼 스캐폴더
대화형으로 플러그인 파일 1개 + `index.js` 등록을 자동 생성. [신규 플랫폼 추가 가이드](#-신규-플랫폼-추가-가이드-plugin-architecture) 참고.

#### C-4. `blinder help` — 도움말
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
| **Node.js** | `const KEY = "sk-..."` | `const KEY = process.env.OPENAI_API_KEY` |
| **React (CRA)** | `apiKey: "AIza..."` | `apiKey: process.env.REACT_APP_FIREBASE_API_KEY` |
| **React (Vite)** | `apiKey: "AIza..."` | `apiKey: import.meta.env.VITE_FIREBASE_API_KEY` |
| **React (Next.js, client)** | `apiKey: "AIza..."` | `apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY` |
| **Spring Boot (Java)** | `@Value("plain-secret")` | `@Value("${SECRET_NAME}")` |
| **Spring Boot (.yml)** | `password: "abc123"` | `password: ${DB_PASSWORD}` |
| **Ruby** | `ENDPOINT = "https://hooks.slack.com/..."` | `ENDPOINT = ENV["SLACK_WEBHOOK_URL"]` |

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

#### ⚛️ React (CRA / Vite / Next.js)
- 빌드 도구 자동 감지 (`react-scripts` / `vite` / `next` deps).
- **Next.js**: 파일 경로(`pages/api/*`는 서버, `pages/*`는 클라이언트) + `'use client'` 디렉티브로 클라/서버 판별. 클라이언트 파일은 `NEXT_PUBLIC_` 접두사 자동 부여.

#### ☕ Spring Boot
- `@Value("plain-secret")` → `@Value("${VAR}")` 자동 마이그레이션.
- 이미 `${prop:default}` placeholder 형태인 경우는 fallback 의도 보호 — 자동 변환 보류.
- `.properties` / `.yml` / `.xml`은 `${VAR}` 형태로 치환.

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

## 🆚 다른 도구와 비교

| 도구 | 1차 목적 | 자동 치환 | 빌드 시스템 연동 | AI 공유용 마스킹 | 모바일 (iOS/Android/Flutter) |
|---|---|:---:|:---:|:---:|:---:|
| **Blinder** | AI 시대 시크릿 보호 + 자동 마이그레이션 | ✅ | ✅ (BuildConfig·Podfile·dart-define) | ✅ (mask/restore) | ✅ |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | git 기록 시크릿 스캔 | ❌ | ❌ | ❌ | 부분적 |
| [TruffleHog](https://github.com/trufflesecurity/trufflehog) | 시크릿 검증(verifier) | ❌ | ❌ | ❌ | 부분적 |
| [git-secrets](https://github.com/awslabs/git-secrets) | pre-commit 훅 | ❌ | ❌ | ❌ | ❌ |
| [detect-secrets](https://github.com/Yelp/detect-secrets) | baseline 기반 false-positive 관리 | ❌ | ❌ | ❌ | 부분적 |

> Blinder는 **탐지 + 자동 분리 + 빌드 wiring + AI 공유용 사본**까지 한 도구로 묶은 점이 차별화 포인트입니다. 단순 git history 스캐닝이 목적이면 Gitleaks/TruffleHog가 더 적합합니다.

---

## ❓ FAQ (자주 묻는 질문)

<details>
<summary><strong>Q. 이미 git에 푸시된 시크릿은 어떻게 되나요?</strong></summary>

Blinder는 **현재 워킹 트리** 기준으로 동작합니다. 과거 커밋에 박힌 시크릿은 [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) 또는 `git filter-repo`로 별도 정리한 뒤, **반드시 시크릿을 즉시 회전(rotate)** 하세요.
</details>

<details>
<summary><strong>Q. <code>blind</code>를 실행했는데 빌드가 깨졌어요.</strong></summary>

대부분 `bridge` 미실행이 원인입니다. `blinder bridge`로 BuildConfig / Podfile post_install / dart-define 연동을 완료하세요. 그래도 깨지면 `blinder rollback`으로 즉시 복구 가능합니다.
</details>

<details>
<summary><strong>Q. AI 사본(<code>maskedProject_*</code>)을 그대로 빌드해도 되나요?</strong></summary>

❌ 절대 안 됩니다. 모든 시크릿이 `__BLINDER_VAR__` 토큰으로 치환되어 컴파일 에러 또는 NPE가 발생합니다. AI에게도 "빌드/실행해서 검증해 달라"고 요청하지 마세요. 사본은 **읽기 전용**입니다.
</details>

<details>
<summary><strong>Q. 외부 SDK 폴더 (KeySharp, RSKSW 등)도 스캔되나요?</strong></summary>

기본 휴리스틱(`Copyright`, `SDK`, `Third-party` 문구 감지)으로 자동 제외 시도하지만, 100%는 아닙니다. `.blinderSettings`의 `ignorePaths`에 명시적으로 추가하세요.
</details>

<details>
<summary><strong>Q. CI/CD 파이프라인에 통합하려면?</strong></summary>

`blinder scan --ci`는 시크릿 발견 시 비-0 종료 코드를 반환합니다. GitHub Actions / GitLab CI / Jenkins의 단계로 추가하면 PR 머지 직전 게이팅이 가능합니다.

```yaml
# .github/workflows/blinder.yml
- name: Scan secrets
  run: npx -y github:YellowC-137/Blinder scan --ci
```
</details>

<details>
<summary><strong>Q. 사용자 정의 시크릿 패턴은 어떻게 추가하나요?</strong></summary>

`.blinderSettings`의 `customPatterns`에 정규식 + severity로 등록합니다. 자세한 예시는 [프로젝트 설정](#%EF%B8%8F-프로젝트-설정-blindersettings) 섹션 참고.
</details>

<details>
<summary><strong>Q. Next.js의 <code>NEXT_PUBLIC_</code> 접두사는 어떻게 결정되나요?</strong></summary>

파일 상단 `'use client'` 디렉티브가 있거나 `pages/` 하위(단 `pages/api/*` 제외)이면 클라이언트로 판단하여 `NEXT_PUBLIC_` 접두사를 부여합니다. 그 외 (App Router 기본 RSC, `lib/`, `utils/`)는 서버로 판단하여 bare `process.env.X`를 사용합니다.
</details>

<details>
<summary><strong>Q. <code>.blinder_protect.json</code> / <code>.blinder_map.json</code>은 git에 커밋해야 하나요?</strong></summary>

❌ 둘 다 자동으로 `.gitignore`에 추가됩니다. 로컬 메타데이터이며 푸시 대상이 아닙니다. 단, **로컬에서 절대 삭제하지 마세요** — 삭제 시 정확한 위치 복원/머지가 불가능합니다.
</details>

---

## 🗺️ 로드맵

| 단계 | 항목 | 상태 |
|---|---|:---:|
| **언어/프레임워크** | Python (Django/FastAPI), Go, PHP (Laravel), Rust 플러그인 | 🟡 계획 |
| **언어/프레임워크** | Vue.js / Nuxt, SvelteKit, Astro | 🟡 계획 |
| **AI 통합** | MCP (Model Context Protocol) 서버 모드 — IDE에서 직접 mask/restore | 🟡 계획 |
| **검출 엔진** | 시크릿 verifier (live-key 검증) — TruffleHog 스타일 | 🟡 계획 |
| **검출 엔진** | 엔트로피 기반 unknown-pattern 가설 | ✅ 부분 (`isPlaceholderValue`) |
| **CI** | GitHub Actions / GitLab CI / Bitbucket Pipelines 공식 액션 | 🟡 계획 |
| **리포트** | SARIF 출력 (GitHub Code Scanning 연동) | 🟡 계획 |
| **Git 기록** | 과거 커밋 시크릿 일괄 정리 헬퍼 (BFG 래퍼) | 🟡 검토 |

> 우선순위 제안 / 신규 항목은 [GitHub Issues](https://github.com/YellowC-137/Blinder/issues)로 부탁드립니다.

---

## 🔌 신규 플랫폼 추가 가이드 (Plugin Architecture)

코어 엔진 수정 없이 새 언어/프레임워크 지원 가능. 풀 가이드 + 트러블슈팅은 [CONTRIBUTING.md](./CONTRIBUTING.md) 참고.

### 🗺️ 플러그인이 하는 일

각 언어/프레임워크를 **플러그인 1개 = 파일 1개**로 표현. 코어 엔진은 언어 규칙을 절대 모르고, 플러그인이 다음을 알려줌:

| 책임 | 메서드 |
|---|---|
| 이 프로젝트가 내 플랫폼인가? | `detect(repoPath)` |
| 어떤 확장자 스캔할 건가? | `commonExtensions` |
| 시크릿 발견 시 무엇으로 치환할 건가? | `getAutoFixReplacement(match, envVarName, ext)` |
| (선택) `.env`를 빌드 시스템에 어떻게 연동? | `setupBridge(repoPath)` / `teardownBridge(repoPath)` |
| (선택) 단순 치환으로 안 되는 케이스? | `applyAdvancedFix(context)` |

플러그인 파일 작성 → `src/platforms/index.js` 등록 → 끝.

### 🚀 가장 빠른 길: CLI 스캐폴더

```bash
blinder add_platform
# 또는
npm run add-platform
```

대화형으로 5가지 입력:

| 입력 | 의미 | 예시 |
|---|---|---|
| Platform ID | 내부 식별자 + 파일명 | `django` |
| 표시명 | 사용자에게 보이는 이름 | `Django` |
| Category | Backend / Frontend / Mobile / Custom | `Backend` |
| 스캔 확장자 | 콤마 구분 | `.py,.html` |
| 감지 파일 | `detect()` 마커 | `manage.py` |

자동 동작:
1. `src/platforms/<category>/<id>.js` 템플릿 생성 — **첫 확장자 기준** env 접근자 자동 선택:

   | 첫 확장자 | 자동 접근자 |
   |---|---|
   | `.py` | `os.environ.get("VAR")` |
   | `.rb` | `ENV["VAR"]` |
   | `.java` / `.kt` | `System.getenv("VAR")` |
   | `.go` | `os.Getenv("VAR")` |
   | `.rs` | `std::env::var("VAR").unwrap_or_default()` |
   | `.php` | `getenv('VAR')` |
   | 그 외 | `process.env.VAR` |

2. `src/platforms/index.js`에 import + 배열 항목 자동 추가.

생성 후 출력되는 "🚀 다음 단계" 메시지대로 `detect()` / `getAutoFixReplacement()` 다듬고 `blinder scan --dry-run`으로 검증.

### ✍️ 직접 작성하고 싶다면: 최소 템플릿

`detect`, `commonExtensions`, `getAutoFixReplacement`만 있으면 동작.

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

`src/platforms/index.js`에 등록:

```javascript
import python from './backend/python.js';

export const platforms = [
  common, ios, android, flutter, ruby,
  python
];
```

> [!TIP]
> **`definePlatform()`은 필수 필드(`id`, `name`, `detect`, `commonExtensions`)를 로드 시점에 검증**하고 누락 시 즉시 throw. 옵셔널 훅(`preFix`/`postFix`/`setupBridge` 등)은 안전한 기본값으로 채워짐.

### 🎁 자주 추가하는 옵션

```javascript
definePlatform({
  // ...필수 필드 생략

  // 항상 플래그할 민감 파일
  sensitiveFiles: [
    { glob: '**/local_settings.py', severity: 'CRITICAL', reason: 'Django 로컬 시크릿' }
  ],

  // 스캔에서 제외 (벤더, 빌드 결과물 등)
  ignorePaths: ['**/migrations/**', '**/venv/**'],

  // blinder gitignore가 추가할 섹션
  getGitignoreTemplate: () => `\n# Django\n*.pyc\n__pycache__/\n.env\n`,

  // 확장자별 다른 접근자
  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.html') return `{{ ${envVarName} }}`;
    return `os.environ.get("${envVarName}")`;
  }
});
```

### 🔐 구조화 설정 파일을 다루는 플랫폼이라면

Info.plist / AndroidManifest meta-data / .properties / .xcconfig 같은 키/값 구조 파일은 raw 문자열로 매칭하지 말 것. 스캐너가 전용 파서(`src/detectors/parsers/*`)로 라우팅하고 `src/protectors/keyClassifier.js`로 자동치환을 게이팅함.

자동치환 정책은 **default-deny**:
- ✅ Whitelist 등록 키만 자동치환 (`*_API_KEY`, SDK 키 등)
- ❌ 시스템 키(`CFBundle*`, `androidx.*`, `org.gradle.*`)는 절대 치환 안됨

신규 키 분류 추가는 `keyClassifier.js`에 규칙 추가.

### ✅ 검증

```bash
# 유닛 + 파서 + 분류기 테스트
npm test

# 레지스트리 파싱 확인
node -e "import('./src/platforms/index.js').then(m => console.log(m.platforms.map(p => p.id)))"

# 플랫폼 감지 + Auto-fix 미리보기
blinder scan --path /your/project --dry-run
blinder blind --path /your/project --dry-run -y

# (선택) 실제 샘플 빌드 회귀
npm run test:regression
```

### 🐛 자주 만나는 함정

| 증상 | 해결 |
|---|---|
| `Platform plugin must have an "id" property.` | 필수 필드(`id`/`name`/`detect`/`commonExtensions`) 채우기 |
| 파일은 생성됐는데 동작 안함 | `index.js`에 import + 배열 등록 누락 |
| `Detected platforms`에 안 나타남 | `detect()`가 false. 마커 파일은 **repo 루트** 기준 |
| 주석 안 시크릿까지 치환 | `commentRegex` 오버라이드 |
| `blind` 후 빌드 깨짐 | `setupBridge()` 구현 (BuildConfig / dart-define 등) |
| `rollback` 후 brige 잔존 | `teardownBridge()` 짝 작성 필수 |

자세한 IPlatform 인터페이스 / 라이프사이클 / Bridge 구현 예시: [CONTRIBUTING.md](./CONTRIBUTING.md).

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

> [!CAUTION]
> **이미 노출된 시크릿은 즉시 회전(rotate)**: Blinder는 사후 정리 도구가 아닙니다. git 기록 / 백업 / 외부 공유본에 한 번이라도 노출된 키는 무조건 새 키로 교체하세요.

---

## 🤝 기여하기 · 라이선스 · 감사

### 기여
신규 플랫폼 플러그인, 버그 리포트, 문서 개선, 패턴 추가 모두 환영합니다. 시작은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

- 🐛 **버그 리포트**: [GitHub Issues](https://github.com/YellowC-137/Blinder/issues)
- 💡 **기능 제안**: [GitHub Discussions](https://github.com/YellowC-137/Blinder/discussions)
- 🔌 **신규 플랫폼 PR**: `blinder add_platform` → 생성된 파일 다듬기 → PR

### 라이선스

[ISC License](./LICENSE) © Blinder Contributors.

### 감사

- AST 분석 엔진: [`web-tree-sitter`](https://github.com/tree-sitter/tree-sitter) + [`tree-sitter-wasms`](https://github.com/Menci/tree-sitter-wasms)
- CLI / UX: [`commander`](https://github.com/tj/commander.js), [`inquirer`](https://github.com/SBoudrias/Inquirer.js), [`chalk`](https://github.com/chalk/chalk), [`ora`](https://github.com/sindresorhus/ora)
- 영감을 준 선행 도구: [Gitleaks](https://github.com/gitleaks/gitleaks), [TruffleHog](https://github.com/trufflesecurity/trufflehog), [git-secrets](https://github.com/awslabs/git-secrets), [detect-secrets](https://github.com/Yelp/detect-secrets)

<div align="center">

**시크릿은 사라지게, 코드는 그대로.**
Blinder를 사용하시는 모든 분께 감사드립니다. ⭐ Star로 응원 부탁드려요.

</div>
