# Blinder 🛡️

[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_en.md)

**Blinder**는 AI 에이전트(Cursor, ChatGPT, Claude 등)를 사용할 때 소스 코드 속의 민감정보가 외부로 유출되는 것을 사전에 방지하는 **AI 시대의 보안 자동화 도구**입니다.

모바일 개발 환경(iOS, Android, Flutter)에서 하드코딩된 API 키를 탐지하고, 이를 안전하게 `.env`로 격리하며, AI에게 코드를 넘기기 전 시크릿이 마스킹된 안전한 복사본을 만들어줍니다.

---

## ✨ 핵심 기능

- **🧹 지능형 마스킹 (Mask)**: 원본 코드를 수정하지 않고, 시크릿만 `__BLINDER_VAR__`로 치환된 AI 전송용 복사본을 `.blinder_masked/` 폴더에 생성합니다. (복원 시 원래 값으로 1:1 완벽 복구)
- **🔍 AI 맞춤형 스캐닝**: 주석 내의 시크릿은 무시하고 실제 코드 내의 유효하지 않은 예제 데이터나 테스트 코드(`*Tests*`, `test/`)를 자동으로 필터링하여 오탐을 최소화합니다.
- **🛡️ 자동 환경 변수 변환 (Auto-fix)**: 탐지된 시크릿을 `.env`로 옮기고, Dart/Kotlin/Swift/Obj-C 등 플랫폼에 맞는 환경 변수 참조 코드로 자동 교체합니다.
- **📜 멀티라인 시크릿 탐지**: 일반적인 문자열뿐만 아니라 PEM Private Key, 인증서 등 여러 줄로 구성된 암호화 데이터까지 완벽하게 탐지하고 처리합니다.
- **⚙️ 엔터프라이즈 보안 및 국내 환경 최적화**: Google, AWS, Stripe 등 글로벌 서비스는 물론 Kakao, Naver 등 국내 SDK, IPv4 인프라 주소, DB 연결 문자열 등 국내 엔터프라이즈 환경에서 필수적인 탐지 패턴을 제공합니다.
- **📊 자동 리포트 & CI 지원**: 실행 시마다 `blinder_reports/`에 스캔 이력을 저장하며, `--ci` 모드를 통해 파이프라인에서 보안 사고를 원천 차단합니다.

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

#### 2. `blinder bridge` (네이티브 연동)
생성된 `.env` 파일의 내용이 안드로이드(`BuildConfig`), iOS(`Info.plist`), Flutter(`--dart-define`) 시스템에서 자동으로 인식되도록 빌드 설정을 자동화합니다.
- **Android**: `build.gradle`에 환경 변수 로딩 스크립트 자동 주입.
- **iOS**: Xcode 빌드 단계에 주입할 수 있는 가이드 스크립트(`blinder-ios-setup.sh`) 생성.
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
현재 프로젝트 플랫폼(iOS, Android, Flutter)에 맞춰 유출되기 쉬운 파일들과 Blinder 생성 파일을 `.gitignore`에 자동으로 추가합니다.

#### 8. `blinder help` (도움말)
사용 가능한 모든 명령어와 상세 옵션 설명을 터미널에 출력합니다.

---

## 🛠️ 프로젝트 설정 (`.blinderrc`)

프로젝트 루트에 `.blinderrc` 파일을 만들어 Blinder의 동작을 커스터마이징할 수 있습니다.

```json
{
  "customPatterns": [
    { "name": "Internal API", "regex": "INTERNAL_[A-Z]{3}_KEY_[0-9a-f]{32}", "severity": "CRITICAL" }
  ],
  "ignorePaths": ["**/test/mocks/**"],
  "maskOutput": ".tmp_safe_code"
}
```

---

## 📱 플랫폼별 Auto-fix 예시

| 플랫폼 | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS** | `"glpat...789"` | `ProcessInfo.processInfo.environment["GITLAB_TOKEN"] ?? ""` |

### ⚠️ 플랫폼별 Auto-fix 유의사항 (Caveats)

각 플랫폼별로 언어의 특성과 빌드 시스템에 따라 `blinder protect` (Auto-fix) 적용 시 반드시 알아두어야 할 주의사항이 있습니다. (`blinder mask`는 언어를 가리지 않고 단순 치환하므로 아래 제약과 무관하게 100% 완벽 동작합니다.)

#### 🍎 iOS (Objective-C)
* **전역 상수 제약**: `NSString *const API_KEY = @"..."` 형태의 전역 상수는 `[[NSBundle mainBundle] ...]` 과 같은 런타임 함수로 초기화할 수 없는 C언어의 문법 한계가 있습니다. (적용 시 `Initializer element is not a compile-time constant` 빌드 에러 발생)
* **Blinder의 처리**: 이로 인해 Obj-C의 전역 상수는 강제로 `isFixable: false` 처리되어 Auto-fix 대상에서 안전하게 제외(Skip)됩니다.
* **해결책**: 해당 상수들을 Auto-fix 되도록 하려면, 소스 코드에서 상수를 **매크로 (`#define API_KEY @"..."`)** 형태로 한 번 리팩토링해 주시면 완벽하게 지원됩니다.

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

## 스캔 리포트 예시 (Terminal Output)

```text
✔ Project root: /Users/dev/my-mobile-app
✔ Detected platforms: flutter, ios, android
- Scanning for secrets...
✔ Scan complete. Found 3 potential secrets.

Scan Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ [HIGH] lib/main.dart:10 - Google API Key
ℹ    Match: AIza...3456
⚠ [HIGH] ios/Runner/AppDelegate.swift:5 - GitLab Personal Access Token
ℹ    Match: glpa...ghij
⚠ [TEST KEY] test/mocks.dart:2 - Generic API Key
ℹ    Match: test...1234
```

---

## 주의사항

> [!CAUTION]
> **빌드 설정 파일 수정**: Blinder의 `blind` (Auto-fix) 및 `bridge` 기능은 프로젝트의 핵심 빌드 파일(`build.gradle`, `.pbxproj`, `Info.plist` 등)을 직접 수정합니다. 실행 전 반드시 모든 변경 사항을 **Git에 커밋**하여 복구가 가능한 상태를 유지하세요.

> [!IMPORTANT]
> **Auto-fix 전 백업 필수**: Blinder는 실제 소스 코드를 수정합니다. `git commit`이 완료된 상태에서 실행하여 변경 사항을 쉽게 검토하세요.

> [!WARNING]
> **.env 파일 관리**: Blinder가 `.gitignore`에 자동으로 `.env`를 추가하지만, 항상 최종 커밋 전 `.env`가 Git에 포함되지 않았는지 수동으로 확인하는 습관을 권장합니다.
