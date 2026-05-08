# 🔧 플랫폼별 상세 가이드

> `blind` 워크플로의 Auto-fix 예시 + 플랫폼별 유의사항 + 구조화 파일 정책.

---

## Auto-fix 변환 예시

| 플랫폼 | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter (Dart)** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android (Kotlin/Java)** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS (Swift)** | `"glpat...789"` | `Bundle.main.object(forInfoDictionaryKey: "GITLAB_TOKEN")` |
| **iOS (Obj-C)** | `NSString *const API_URL = @"..."` | `#define API_URL [NSBundle.mainBundle objectForInfoDictionaryKey:@"API_URL"]` |
| **Node.js** | `const KEY = "sk-..."` | `const KEY = process.env.OPENAI_API_KEY` |
| **React (CRA)** | `apiKey: "AIza..."` | `apiKey: process.env.REACT_APP_FIREBASE_API_KEY` |
| **React (Vite)** | `apiKey: "AIza..."` | `apiKey: import.meta.env.VITE_FIREBASE_API_KEY` |
| **React (Next.js, client)** | `apiKey: "AIza..."` | `apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY` |
| **Spring Boot (Java)** | `@Value("plain-secret")` | `@Value("${SECRET_NAME}")` |
| **Spring Boot (.yml)** | `password: "abc123"` | `password: ${DB_PASSWORD}` |
| **Ruby** | `ENDPOINT = "https://hooks.slack.com/..."` | `ENDPOINT = ENV["SLACK_WEBHOOK_URL"]` |

---

## 플랫폼별 유의사항

### 🍎 iOS (Objective-C)
- `NSString *const` → C 컴파일타임 제약 → Blinder가 `#define` 매크로로 자동 마이그레이션.
- `int`/`double` 등 원시 타입 상수는 자동치환 제외. 수동 처리 필요.

### 🍏 iOS (Swift)
- `Bundle.main.object(forInfoDictionaryKey:...)` 주입.
- 런타임에 값이 채워지려면 `.xcconfig` + `Info.plist` 연동 필수 → `blinder bridge` 자동화.

### 🤖 Android (Kotlin / Java)
- 기본 치환: `BuildConfig.VARIABLE_NAME`. `blinder bridge`가 `build.gradle`에 BuildConfig 스크립트 자동 주입.
- `AndroidManifest.xml`: `${VARIABLE_NAME}` placeholder. `manifestPlaceholders` 등록 → bridge가 처리.

### 🦋 Flutter (Dart)
- `String.fromEnvironment('VAR')` 치환.
- 빌드 시 `--dart-define-from-file=.env` 필수 → bridge가 IDE 실행 설정 + `f.sh` 래퍼 자동 추가.

### ⚛️ React (CRA / Vite / Next.js)
- 빌드 도구 자동 감지 (`react-scripts` / `vite` / `next` deps).
- **Next.js**: `pages/api/*` → 서버, `pages/*` + `'use client'` → 클라이언트 → `NEXT_PUBLIC_` 접두사 자동 부여.

### ☕ Spring Boot
- `@Value("plain-secret")` → `@Value("${VAR}")` 자동 마이그레이션.
- 이미 `${prop:default}` 형태면 변환 보류 (fallback 의도 보호).
- `.properties` / `.yml` / `.xml` → `${VAR}` 형태 치환.

---

## 구조화 파일 자동치환 정책

`Info.plist`, `AndroidManifest.xml`, `gradle.properties`는 화이트리스트 기반으로만 자동치환:

| 파일 | 자동치환 대상 | 차단 대상 |
|---|---|---|
| Info.plist | `KAKAO_*`, `NAVER_*`, `GMSApiKey`, `*_API_KEY` 등 | `CFBundle*`, `NS*`, `UI*`, `LS*` |
| AndroidManifest meta-data | `com.kakao.sdk.*`, `com.google.android.geo.API_KEY` 등 | `androidx.*`, `com.google.android.gms.version` |
| gradle.properties | `API_KEY`/`TOKEN`/`PASSWORD` 힌트 포함 키 | `org.gradle.*`, `android.*`, `kotlin.*` |
| local.properties | (영구 차단) | 모든 키 |
| .xcconfig | (영구 차단) | 모든 키 |

---

## 두 워크플로 비교

| 구분 | `blind` 워크플로 | `mask` 워크플로 |
|---|---|---|
| **목적** | 시크릿을 `.env`로 분리, 코드 실행 가능 유지 | AI가 비즈니스 로직만 읽도록 시크릿 완전 제거 |
| **원본 코드** | 직접 수정 | 변경 없음 (별도 복사본) |
| **빌드 가능?** | ✅ (bridge 필요) | ❌ 읽기 전용 |
| **사용 시나리오** | 운영 / 팀 공유 / Git | AI 리뷰 / 외부 공유 |
| **대응 명령** | `blind` ↔ `rollback` | `mask` ↔ `restore` |
