# Changelog

본 프로젝트는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며, [Semantic Versioning](https://semver.org/lang/ko/) 을 적용한다.

날짜는 KST 기준.

---

## [Unreleased]

### Added
- 신규 기능은 여기에.

### Changed
- 동작 변경은 여기에.

### Deprecated

### Removed

### Fixed

### Security

---

## [1.1.0] - 2026-04-30

대규모 보안 / 구조 / 운영 개선. 자세한 내용은 `IMPROVEMENTS_2026-04-30.md` 참고.

### Added
- `src/utils/regexGuard.js` — `.blinderSettings.customPatterns` ReDoS 가드 (정적 분석 + 50ms self-test).
- `src/detectors/scannerHelpers.js` / `src/detectors/structuredScanner.js` — `scanner.js` 분할 (661 LOC → 423 LOC).
- `src/utils/logger.js` `finding()` 헬퍼 — 일관된 한 줄 finding 포맷.
- `bin/blinder.js` `--help` 후미 환경변수 / 워크플로 / 예시 추가.
- `.github/workflows/ci.yml` — Node 20/22 매트릭스 + 시크릿 누출 가드 잡.
- `.github/dependabot.yml` — 주간 npm + github-actions 업데이트.
- `BasePlatform.preFix` / `postFix` JSDoc — 에러 시맨틱 명문화.
- `package.json` `engines.node` (≥20.12), `files` allowlist.
- `test/regression/_lib.sh` `with_timeout` 래퍼 + `BLINDER_REGRESSION_TIMEOUT` 환경변수.
- `SECURITY.md` / `CHANGELOG.md` / 이슈·PR 템플릿.

### Changed
- `src/platforms/frontend/react.js` — 모듈 전역 `let cachedBuildTool` / `currentFileClientSide` 제거. `Map<repoPath, state>` 로 격리.
- `src/detectors/scanner.js` — `pattern.regex.exec()` 루프 → `String.matchAll()`. 글로벌 `lastIndex` 공유 race 제거.
- `src/utils/config.js` — `customPatterns` 자동 sanitize 통합.
- `package.json` `engines.node`: `>=18.0.0` → `>=20.12.0` (inquirer@13 의존성 `@inquirer/core` 가 `node:util.styleText` 사용 — Node 20.12+ 필요).

### Fixed
- `src/utils/iosBridge.js` — Run Script Phase 의 PlistBuddy `-c` 인자에 `.env` 키/값 직접 보간 → 키 형식 검증 (`^[A-Za-z_][A-Za-z0-9_]*$`) + 값 내 `\\` / `"` escape. `.env` 값에 따옴표 / 백슬래시 포함 시 plist 명령 깨짐 차단.
- `src/detectors/scanner.js` — `.blinderSettings` 추가 ignorePaths 로딩의 silent `catch (err) {}` 제거. 스키마 검증 + `logger.warn` 알림.

### Security
- 사용자 정의 정규식 catastrophic backtracking 차단 (`(a+)+`, 연속 `.*` 등 정적 분석 + worst-case 동적 self-test).
- iOS bridge bash 인젝션 표면 축소 (PlistBuddy 인자 escape).
- 사용자 설정 파일 (`.blinderSettings`) 스키마 검증 강화.

### audit 항목 중 수정 불필요로 재평가
- `restoreService.js:47-48` 정규식 ID 이스케이프 — 이미 `escapeRegExp` 적용.
- `protectionService.js` 라이프사이클 훅 try/catch — 이미 래핑.
- `patterns.js` 정규식 캐싱 — 이미 모듈 스코프 리터럴.

---

## [1.0.0] - 초기 릴리스

기본 시크릿 탐지 / blind / mask / restore 워크플로. 플랫폼 플러그인: ios, android, flutter, react, node, java, springboot, ruby, common.

[Unreleased]: https://github.com/jshwang8048/Blinder/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/jshwang8048/Blinder/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/jshwang8048/Blinder/releases/tag/v1.0.0
