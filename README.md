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

Blinder를 시스템에 설치하고 사용하는 방법은 두 가지가 있습니다.

### 방법 1: 개발 모드 (추천)
소스 코드를 다운로드하여 직접 링크하는 방식입니다. 최신 업데이트를 바로 반영할 수 있습니다.

```bash
# 1. 저장소 클론
git clone https://github.com/YellowC-137/Blinder.git
cd Blinder

# 2. 의존성 설치
npm install

# 3. 전역 명령어로 등록
# 'npm link'는 현재 디렉토리의 패키지를 시스템 전역(Global)에 심볼릭 링크로 연결합니다.
# 이를 통해 어디서든 'blinder' 명령어를 입력하면 현재 소스 코드가 실행됩니다.
sudo npm link
```

### 방법 2: 패키지 직접 설치
저장소의 최신 버전을 npm을 통해 직접 전역 설치합니다.

```bash
# GitHub 저장소에서 직접 글로벌 설치
npm install -g github:YellowC-137/Blinder
```

---

## 명령어 및 옵션 상세

모든 명령어는 기본적으로 전역 옵션을 공유하며, 각 명령어별 전용 옵션이 존재합니다.

### 🌐 전역 옵션 (Global Options)
모든 명령어 뒤에 붙여서 사용할 수 있습니다.
- `-p, --path <path>`: Blinder가 작업을 수행할 태스크 디렉토리를 지정합니다. (기본값: 현재 디렉토리)
- `--dry-run`: 실제 파일을 수정(쓰기/삭제)하지 않고, 어떤 변경이 일어날지 로그로만 출력합니다. 안정성 확인을 위해 처음에 사용하기 좋습니다.
- `-h, --help`: 명령어 도움말을 출력합니다.

---

### 1. `blinder scan`
프로젝트 내의 민감정보를 찾아내 리포트를 생성합니다.

| 옵션 | 설명 | 비고 |
| :--- | :--- | :--- |
| `-o, --output <file>` | 스캔 결과를 JSON 파일로 저장합니다. | 자동화 파이프라인 연동 시 유용 |
| `--include-examples` | 테스트(`test/`), 예제(`example/`) 폴더 내 시크릿도 포함합니다. | 기본적으로는 무시됨 |

**사용 예시:**
```bash
blinder scan -p ./my-project --include-examples
```

---

### 2. `blinder protect`
탐지된 시크릿을 `.env`로 마이그레이션하고 소스 코드를 수정합니다. 실행 시 다음 과정이 진행됩니다.
1. **운영용 시크릿**을 자동으로 `.env`에 추가 (중복 제외)
2. **테스트용 시크릿** 포함 여부 선택
3. **소스 코드 자동 수정(Auto-fix)** 여부 선택

**사용 예시:**
```bash
blinder protect --dry-run # 시뮬레이션 모드
```

---

### 3. `blinder gitignore`
현재 프로젝트 환경(iOS/Android/Flutter)에 최적화된 `.gitignore` 파일을 생성하거나 기존 파일에 보안 규칙을 추가합니다.

**사용 예시:**
```bash
blinder gitignore
```

---

### 4. `blinder init` (추천)
위의 모든 과정을 순차적으로 한 번에 수행하는 명령어입니다.
`gitignore 생성` → `시크릿 스캔` → `보호 조치(Protect)` 순으로 진행됩니다.

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
