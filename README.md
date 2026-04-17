# Blinder 🛡️

**Blinder**는 iOS, Android, Flutter 프로젝트를 위한 지능형 보안 자동화 CLI 도구입니다. 소스 코드에 하드코딩된 API 키와 민감정보를 탐지하고, 이를 안전하게 `.env`로 격리하며, 플랫폼별 최적의 환경 변수 참조 코드로 자동 변환해 줍니다.

---

## 주요 기능

- **🔍 지능형 스캐닝**: GitHub, GitLab, Stripe, Google API Key 등 20개 이상의 패턴 탐지 및 'Test' 키 자동 감별.
- **🛡️ 2단계 보호 프로세스**: 운영용 시크릿을 먼저 처리하고, 테스트용 키는 선택적으로 수정하는 안전한 UX 제공.
- **✨ 시크릿 마스킹**: 터미널 출력 및 로그에서 시크릿의 핵심 정보를 마스킹하여(예: `AIza...3456`) 2차 유출 방지.
- **📝 환경 변수 자동 교체 (Auto-fix)**: 각 플랫폼(Dart, Kotlin, Swift)에 맞는 최적화된 환경 변수 호출 코드로 물리적 코드 교체.
- **⚙️ .gitignore 최적화**: 모바일 플랫폼별로 유출되기 쉬운 파일(Keystore, .env, Local.properties 등) 보호 설정.

---

## 설치 및 준비

```bash
# 1. 저장소 클론 또는 다운로드 후 이동
cd Blinder

# 2. 전역 명령어로 등록
npm link

# 3. 이제 어디서든 'blinder' 명령어를 사용하세요!
```

---

## 명령어 및 옵션 상세

### `blinder scan`
프로젝트를 스캔하여 민감정보 리포트를 출력합니다.
- `-p, --path <dir>`: 스캔할 프로젝트 경로 지정 (기본값: 현재 폴더)
- `-o, --output <file>`: 스캔 결과를 JSON 파일로 저장
- `--include-examples`: 테스트/예제 폴더 내의 시크릿까지 포함하여 스캔

### `blinder protect`
탐지된 시크릿을 `.env`로 옮기고 코드 교체 작업을 진행합니다.
- `--dry-run`: 실제 파일을 수정하지 않고 변경될 내용만 미리 보기

### `blinder init`
스캔, 보호, `.gitignore` 설정을 한 번에 수행합니다.

---

## 플랫폼별 실제 적용 예시

Blinder의 **Auto-fix** 기능을 사용하면 다음과 같이 코드가 자동 변환됩니다.

### Flutter (Dart)
**Before:**
```dart
const apiKey = "AIzaSyB-EXAMPLE-KEY-123456";
```
**After (Blinder Auto-fix):**
```dart
const apiKey = String.fromEnvironment('GOOGLE_API_KEY');
```

### Android (Kotlin/Java)
**Before:**
```kotlin
val secret = "sk_live_1234567890qwerrtyuuii"
```
**After (Blinder Auto-fix):**
```kotlin
val secret = BuildConfig.STRIPE_LIVE_SECRET_KEY
```

### iOS (Swift)
**Before:**
```swift
let token = "glpat-1234567890abcdefghij"
```
**After (Blinder Auto-fix):**
```swift
let token = ProcessInfo.processInfo.environment["GITLAB_PERSONAL_ACCESS_TOKEN"] ?? ""
```

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

? Would you like to proceed with secret protection (Auto-fix or Manual)? (Y/n)
```

---

## 주의사항

> [!IMPORTANT]
> **Auto-fix 전 백업 필수**: Blinder는 실제 소스 코드를 수정합니다. `git commit`이 완료된 상태에서 실행하여 변경 사항을 쉽게 검토하세요.

> [!WARNING]
> **.env 파일 관리**: Blinder가 `.gitignore`에 자동으로 `.env`를 추가하지만, 항상 최종 커밋 전 `.env`가 Git에 포함되지 않았는지 수동으로 확인하는 습관을 권장합니다.
