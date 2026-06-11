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

## [1.1.0] - 2026-06-11

TypeScript 마이그레이션 + 대규모 보안 / 구조 / 운영 개선. v1.0.0 이후 변경 전체 포함 (2026-04-30 개선분은 `IMPROVEMENTS_2026-04-30.md` 참고).

### Security
- **시크릿 매핑 파일 위치 이동** — 마스킹 사본 내부 `.blinder_map.json` → 프로젝트 루트 `.blinder_maps/<사본폴더명>.json`. 사본 폴더를 통째로 AI에 공유해도 시크릿 유출 없음. 구버전 레이아웃은 `restore` 가 계속 인식.
- `restore` cleanup 시 매핑 파일 자동 삭제 — 사본 제거 후 시크릿 잔존(orphan map) 방지.
- `performMasking` 경로 탈출 방어 — `..` / 절대경로 항목은 사본 복사에서 제외.

### Added
- `.gitignore` Blinder 블록에 `# --- BLINDER <ID> END ---` 종료 마커 — `rollback` 이 사용자 라인을 건드리지 않고 Blinder 블록만 정밀 제거.
- `test/fix_review_test.js` — parseEnv / cleanGitignore / regexGuard / 맵 위치 / findMaskedDirectory 회귀 테스트 23종.
- `.github/dependabot.yml` — `web-tree-sitter` ≥0.26 ignore (tree-sitter-wasms dylink 비호환).

### Changed
- **전체 코드베이스 TypeScript(strict) 마이그레이션** — NodeNext ESM, tsx 로더 기반 테스트.
- `web-tree-sitter` 0.25.10 으로 업그레이드/고정 — named export(`Parser`/`Language`) API 대응. 0.26+ 은 모든 언어 wasm 로드가 실패하므로 차단.
- `add_platform` 스캐폴더가 `.ts` 플러그인 생성 + `index.ts` 등록.
- 문서 전면 갱신 — README(ko/en), docs/*, CONTRIBUTING: 맵 위치 / 토큰 포맷 / Node 20.12+ / TS 기준 반영.

### Fixed
- `package.json` 에 `p-limit` 의존성 누락 — 신규 설치 시 `blinder` 실행 불가 + CI 전 매트릭스 실패 원인.
- `cleanGitignore` 가 BLINDER 블록 뒤 사용자 `.gitignore` 내용을 파일 끝까지 삭제하던 버그.
- 사용자 정의 패턴 RegExp 인스턴스에 `g` 플래그 미강제 → `matchAll` TypeError 로 해당 파일 스캔이 통째로 스킵되던 문제 (시크릿 미탐).
- `parseEnv` 1글자 따옴표 값(`"` / `'`) 오파싱.
- 대용량 파일 EOL 감지 — 문자열 내 `\r` 을 CRLF 로 오인해 AST 오프셋이 틀어지던 문제.

---

### 2026-04-30 개선분 (상세)

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

[Unreleased]: https://github.com/YellowC-137/Blinder/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/YellowC-137/Blinder/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/YellowC-137/Blinder/releases/tag/v1.0.0
