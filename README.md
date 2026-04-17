# Blinder 🛡️

Blinder는 iOS, Android, Flutter 프로젝트를 위한 지능형 보안 자동화 CLI 도구입니다. 소스 코드에 하드코딩된 API 키와 민감정보를 탐지하고, 이를 안전하게 `.env` 파일로 분리하며, 플랫폼별 최적의 `.gitignore`를 자동 생성해 줍니다.

---

## 주요 기능

- **🔍 시크릿 스캐닝 (`scan`)**: 20개 이상의 정규식 패턴과 엔트로피 분석을 통해 하드코딩된 API 키, 토큰, 비밀번호 등을 탐지합니다.
- **🛡️ 자동/수동 보호 (`protect`)**:
  - **Auto-fix**: 탐지된 시크릿을 `.env`로 옮기고 소스 코드의 해당 지점을 환경 변수 호출 코드로 자동 대체합니다.
  - **Manual**: `.env` 파일 구성 및 수동 수정을 위한 플랫폼별 가이드를 제공합니다.
- **📝 .gitignore 자동 생성**: 모바일 프로젝트(iOS, Android, Flutter)에서 유출되기 쉬운 파일들을 포함한 포괄적인 `.gitignore`를 작성하거나 기존 파일에 병합합니다.
- **🚀 프로젝트 초기화 (`init`)**: 스캔부터 보호, `.gitignore` 설정까지 한 번에 처리합니다.

---

## 설치 및 사용법

### 1. 전역 설치
프로젝트의 루트 디렉토리에서 다음 명령어를 실행하여 `blinder` 명령어를 어디서든 사용할 수 있게 등록합니다.

```bash
npm link
```

### 2. 사용 예시

```bash
# 프로젝트 보안 스캔 (이후 보호 단계 진행 여부를 묻습니다)
blinder scan

# 특정 디렉토리 스캔
blinder scan --path ./my-app

# .gitignore 자동 생성 및 병합
blinder gitignore

# 전체 보안 설정 초기화
blinder init
```

---

## 지원 플랫폼 및 파일

- **Flutter**: `.dart`, `pubspec.yaml`, `.xml`, `.plist`
- **iOS**: `.swift`, `.m`, `.h`, `.plist`, `.xcconfig`
- **Android**: `.kt`, `.java`, `.xml`, `.gradle`, `.properties`, `.json`

---

## 주의사항

> [!IMPORTANT]
> **저장 전 커밋**: `protect` (특히 Auto-fix) 기능은 소스 코드를 물리적으로 수정합니다. 반드시 `git commit`이 완료된 상태에서 실행하여 변경 사항을 쉽게 검토하고 되돌릴 수 있도록 하십시오.

> [!WARNING]
> **.env 공유 주의**: `.env` 파일에는 실제 운영 시크릿이 포함되므로 절대 버전 관리 시스템(Git)에 포함시키지 마십시오. Blinder가 생성한 `.gitignore`가 이를 보호해 주지만, 최종 커밋 전 항상 확인하시기 바랍니다.

---

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
