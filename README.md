# Blinder 🛡️

**Blinder**는 AI 에이전트(Cursor, ChatGPT, Claude 등)를 사용할 때 소스 코드 속의 민감정보가 외부로 유출되는 것을 사전에 방지하는 **AI 시대의 모바일 보안 자동화 도구**입니다.

모바일 개발 환경(iOS, Android, Flutter)에서 하드코딩된 API 키를 탐지하고, 이를 안전하게 `.env`로 격리하며, AI에게 코드를 넘기기 전 시크릿이 정화된 안전한 복사본을 만들어줍니다.

---

## ✨ 핵심 기능

- **🧹 지능형 정화 (Sanitize)**: 원본 코드를 수정하지 않고, 시크릿만 `<REDACTED>`로 치환된 AI 전송용 복사본을 `.blinder_sanitized/` 폴더에 생성합니다.
- **🔍 AI 맞춤형 스캐닝**: 주석 내의 시크릿은 무시하고 실제 코드 내의 유효한 시크릿만 탐지하여 오탐을 최소화합니다.
- **🛡️ 자동 환경 변수 변환 (Auto-fix)**: 탐지된 시크릿을 `.env`로 옮기고, Dart/Kotlin/Swift 등 플랫폼에 맞는 환경 변수 참조 코드로 자동 교체합니다.
- **⚙️ 엔터프라이즈 보안 지침 준수**: Google, AWS, Stripe 등 글로벌 서비스는 물론 Kakao, Naver 등 국내 SDK 키와 `.p12`, `.keystore` 등 민감 파일까지 완벽 탐지합니다.
- **📊 자동 리포트 & CI 지원**: 실행 시마다 `blinder_reports/`에 스캔 이력을 저장하며, `--ci` 모드를 통해 파이프라인에서 보안 사고를 원천 차단합니다.

---

## 🚀 시작하기

### 설치

```bash
# 저장소 클론 및 설치
git clone https://github.com/YellowC-137/Blinder.git
cd Blinder
npm install
sudo npm link
```

### 필수 명령어

#### 1. `blinder init` (초기 설정)
프로젝트 내의 시크릿을 탐지하고 `.env`로 마이그레이션하여 프로젝트 보안 기초를 다집니다.

#### 2. `blinder sanitize` (AI 전송 전)
AI 에이전트(Cursor 등)에게 프로젝트 전체의 맥락을 제공하면서도 시크릿은 유출되지 않도록 **정화된 프로젝트 복사본**을 생성합니다.
```bash
blinder sanitize
# 프로젝트 전체가 복사되며 시크릿만 <REDACTED>로 마스킹됩니다.
```

#### 3. `blinder restore` (AI 작업 후)
AI 에이전트가 `.blinder_sanitized/` 폴더 내에서 수정한 **모든 코드와 새 파일**을 원본 프로젝트로 가져옵니다. 이때 마스킹되었던 시크릿은 자동으로 실제 값으로 복원됩니다.
```bash
blinder restore
# AI의 로직 수정사항은 반영되고, 시크릿은 안전하게 다시 채워집니다.
```

#### 4. `blinder scan --ci` (파이프라인 검증)
CI/CD 과정에서 시크릿 유출 여부를 자동으로 체크합니다. 시크릿 발견 시 빌드를 중단시킵니다.

---

## 🛠️ 프로젝트 설정 (`.blinderrc`)

프로젝트 루트에 `.blinderrc` 파일을 만들어 Blinder의 동작을 커스터마이징할 수 있습니다.

```json
{
  "customPatterns": [
    { "name": "Internal API", "regex": "INTERNAL_[A-Z]{3}_KEY_[0-9a-f]{32}", "severity": "CRITICAL" }
  ],
  "ignorePaths": ["**/test/mocks/**"],
  "sanitizeOutput": ".tmp_safe_code"
}
```

---

## 📱 플랫폼별 Auto-fix 예시

| 플랫폼 | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
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
