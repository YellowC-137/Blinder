# 📋 Command Reference

> 전체 명령어 가이드. 빠른 시작은 [README](../README.md)를 먼저 확인하세요.

---

## 🟦 그룹 A: `blind` 워크플로 — 실행 가능 상태 유지

> 원본 소스코드를 직접 수정하여 시크릿을 `.env`로 분리. 분리 후에도 빌드/실행이 정상 동작하도록 빌드 시스템을 자동 연동.

### A-1. `blinder blind` — 시크릿 분리 + 자동 치환

시크릿 탐지 → `.env` 생성 → 소스코드를 환경변수 접근자로 자동 치환 → `.gitignore` 자동 갱신을 한 번에 수행. (`scan` + `protect` + `gitignore` 통합)

**인터랙티브 프롬프트** (순서대로 노출):
1. **주석 스캔 여부**: "주석 처리된 코드 안의 시크릿도 스캔할까요?" — 기본 `No`.
2. **커밋 확인**: "현재 변경 사항을 커밋하셨고 진행할 준비가 되셨나요?" — 안전 게이트.
3. **추가 제외 폴더**: 외부 SDK·벤더 라이브러리 등 콤마 구분 glob 패턴 (`**/ExtLib/**, **/Temp/**`). Enter로 건너뛰기.
4. **처리 방식 선택**: Auto-fix / Manual / Exit.

플래그:
- `-y, --yes`: 모든 프롬프트 자동 'yes' 처리. CI/CD 적합.
- `--dry-run`: 실제 수정 없이 변경 미리보기.

> [!NOTE]
> **주석 시크릿 처리**: 옵트인 시 발견되더라도 auto-fix는 건너뜁니다 (이미 dead code → env 치환 무의미). 별도 `💬 Commented-out Secrets` 섹션으로 보고되며, 사용자가 수동으로 해당 라인을 삭제하도록 권고합니다.

> [!CAUTION]
> **원본 소스 직접 수정**: `build.gradle`, `.pbxproj`, `Info.plist` 등 빌드 핵심 파일이 변경됩니다. 실행 전 반드시 **`git commit` 완료** 후 진행하세요.

---

### A-2. `blinder bridge` — 빌드 시스템 연동

`.env` 값을 각 플랫폼 빌드 시스템이 자동 인식하도록 설정. 플랫폼별 `setupBridge()` 호출.

- **Android**: `app/build.gradle`에 `BuildConfig` 자동 주입 + `manifestPlaceholders` 등록.
- **iOS (Native + Flutter)**: `Podfile`의 `post_install` 훅 자동 추가. `pod install` 시 'Blinder Env Loader' Run Script Phase 자동 구성.
- **Flutter**: VS Code/IntelliJ 실행 설정에 `--dart-define-from-file=.env` 자동 추가 + `f.sh` CLI 래퍼 생성.

> [!WARNING]
> **iOS Podfile 부재 시 (수동 설정 필수)**: `blinder-ios-setup.sh` 가이드 따라 Xcode `Build Phases`에 직접 등록. 'Based on dependency analysis' **체크 해제** + 'User Script Sandboxing' **NO** 설정 필수.

---

### A-3. `blinder rollback` — `blind` 원상 복구 (↔ A-1 대응)

`blind`/`protect`로 적용된 환경변수 접근자 치환을 취소하고 하드코딩된 원본 상태로 복원. `.blinder_protect.json` 메타데이터를 기반으로 정확한 위치 복원. Blinder 생성 파일(.env, gitignore 추가 라인 등) 일괄 삭제 옵션 제공.

> [!IMPORTANT]
> `.blinder_protect.json` 손상/유실 시 정확한 위치 복원 불가 → 항상 `blind` 직후 `git commit` 권장.

---

## 🟩 그룹 B: `mask` 워크플로 — AI 공유용 (실행 불가)

> 원본 코드를 그대로 두고 **마스킹된 사본**을 생성. AI가 비즈니스 로직만 읽도록 모든 시크릿/민감 파일을 제거.

### B-1. `blinder mask` — AI 공유용 사본 생성

프로젝트 전체 또는 지정 하위 디렉토리를 복사하여 `maskedProject_<projectName>/` 생성. 모든 시크릿은 `__BLINDER_VAR__` 토큰으로 치환되며, 다음 항목은 사본에서 **완전 제외**:

- SSH/PGP/TLS 키, 인증서 (`*.pem`, `*.p12`, `id_rsa`, ...)
- 클라우드/패키지 매니저 자격증명 (`.aws/credentials`, `.npmrc`, `.kube/config`, ...)
- 빌드 산출물 (`*.apk`, `*.ipa`, `*.dSYM`, `xcuserdata/`, ...)
- 환경변수 변형 (`.env.local`, `.env.production`, ...)
- 백업/IDE 임시 파일 (`*.bak`, `.idea/workspace.xml`, ...)
- DB 덤프, 컴파일 산출물, 압축 파일

**인터랙티브 프롬프트** (순서대로 노출):
1. **마스킹할 하위 디렉토리**: Enter 시 전체 프로젝트, 또는 `src/features/login` 같은 경로 입력.
2. **추가 제외 폴더/파일**: 콤마 구분 glob 패턴 (`**/ExtLib/**, **/allatori/**`). 입력 시 해당 경로는 사본 복사 + 시크릿 스캔 모두에서 즉시 제외.
3. **주석 스캔 여부**: `blind`와 동일.

옵션:
- `-o, --output <dir>`: 마스킹 결과 폴더명. 기본 `maskedProject_<projectName>/`.
- `-y, --yes`: 모든 프롬프트 자동 처리 (전체 프로젝트 / 제외 없음 / 주석 미스캔).

생성된 사본 안에 `.blinder_map.json`이 함께 저장되어 `restore` 시 시크릿 매핑에 사용됩니다.

> [!CAUTION]
> ## 🚨 `mask` 결과물은 **실행 불가**합니다 🚨
> - ❌ **빌드/실행 절대 시도 금지** — 모든 시크릿 값이 `__BLINDER_VAR__` 토큰으로 치환되어 컴파일 에러 또는 런타임 NPE 발생
> - ❌ **마스킹된 사본을 실제 환경에 배포 금지**
> - ✅ **읽기 전용** — AI가 코드 구조/로직 파악, 리팩토링 제안, 버그 진단 등에 활용
> - ✅ **수정된 결과는 `blinder restore`로 원본 프로젝트에 다시 머지** (이때 시크릿이 자동 복원됨)

---

### B-2. `blinder restore` — AI 수정 결과 머지 (↔ B-1 대응)

AI가 마스킹된 사본에서 작업한 **모든 코드 변경 + 신규 파일**을 원본 프로젝트로 안전하게 가져옴. `__BLINDER_VAR__` 토큰은 자동으로 실제 시크릿 값으로 복원. import 누락 등의 정합성 자동 보정 포함.

> [!WARNING]
> 사본 안의 `.blinder_map.json`이 변조/삭제되면 시크릿 복원 불가. AI에게 "맵 파일 정리해줘" 같은 요청 금지.

---

## 🟨 그룹 C: 보조 명령

### C-1. `blinder scan` — 수동 스캔 (수정 없음)

시크릿 탐지 + 상세 리포트 생성. 코드 수정 없음.

- `--ci`: 시크릿 발견 시 비-0 종료 코드 → CI 파이프라인 차단.
- `-o <file>`: JSON 결과 출력.
- `--include-examples`: `test/example` 폴더 내 매치도 포함.
- `--scan-comments`: 주석 처리된 코드 안의 시크릿도 스캔. 결과는 `💬 Commented-out Secrets` 섹션으로 별도 분리되어 보고 (auto-fix 미수행).

**CI/CD 통합 예시:**

```yaml
# .github/workflows/blinder.yml
- name: Scan secrets
  run: npx -y github:YellowC-137/Blinder scan --ci
```

### C-2. `blinder gitignore` — `.gitignore` 자동 보강

감지된 플랫폼별 템플릿(.env, build/, *.jks, ...) + Blinder 생성 파일을 `.gitignore`에 추가.

### C-3. `blinder add_platform` — 신규 플랫폼 스캐폴더

대화형으로 플러그인 파일 1개 + `index.js` 등록을 자동 생성. [아키텍처 가이드](./architecture.md) 참고.

### C-4. `blinder set_language <ko|en>` — CLI 표시 언어 변경

CLI 출력 언어를 한국어 / English로 전환. 설정은 `~/.blinder/config.json`에 저장되며 즉시 적용.

### C-5. `blinder help` — 도움말

모든 명령어 + 옵션 출력.
