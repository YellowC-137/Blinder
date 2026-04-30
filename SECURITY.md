# 보안 정책 (Security Policy)

Blinder 는 시크릿 / API 키 보호를 목적으로 하는 보안 도구입니다. 도구 자체의 취약점은 사용자 시크릿 노출로 직결될 수 있어 심각하게 다룹니다.

## 지원 버전

| 버전 | 상태 |
|------|------|
| 1.x  | ✅ 보안 패치 제공 |
| < 1.0 | ❌ 미지원 |

Node 런타임은 **20.12 이상** 만 지원합니다 (`package.json` `engines` 참고).

## 취약점 신고 (Reporting a Vulnerability)

**공개 이슈로 등록하지 마세요.** 다음 채널로 비공개 신고:

1. **GitHub Security Advisory** (권장):
   `Security` 탭 → `Report a vulnerability` 클릭
2. **이메일** (대체):
   메인테이너에게 직접 (저장소 메인테이너 정보 참조)

신고 시 가능하면 다음 정보를 포함:

- 영향 받는 파일 / 함수 / 커밋 SHA
- 재현 단계 (가능하면 PoC)
- 예상 영향 범위 (CVSS 추정 환영)
- 제안하는 수정 방향 (선택)

## 응답 SLA

| 단계 | 목표 |
|------|------|
| 최초 응답 | 영업일 기준 3일 이내 |
| 트리아지 / 재현 | 7일 이내 |
| 패치 릴리스 | 심각도에 따라 14~60일 |
| 공개 disclosure | 패치 릴리스 후 협의 (보통 30일) |

## 위협 모델 (Threat Model)

Blinder 가 **방어하는 것**:
- AI 에이전트(Cursor, Claude Code 등)가 시크릿이 박힌 코드를 외부로 전송하는 것
- 하드코딩된 API 키 / 토큰 / 비밀번호의 무의식적 커밋
- mask / restore 라운드트립 시 시크릿 복원 정합성

Blinder 가 **방어하지 않는 것**:
- 이미 외부로 유출된 시크릿의 회수 (`git filter-repo`, GitHub 캐시, 백업 등은 별도 조치 필요)
- 런타임 메모리 dump 를 통한 시크릿 추출
- 악의적 의존성 패키지 설치 (`npm audit` / Dependabot 별도 활용)
- 사용자가 직접 `.env` 파일을 commit 하는 행위 (`.gitignore` + pre-commit hook 권장)

## 알려진 위험 영역 (Known Risk Areas)

본 도구의 보안 sensitive 코드 경로:

| 경로 | 위험 |
|------|------|
| `src/utils/iosBridge.js` | Run Script Phase 생성 / PlistBuddy 인자 처리 — 인젝션 주의 |
| `src/utils/regexGuard.js` | 사용자 정의 정규식 ReDoS 차단 — 우회되면 DoS |
| `src/detectors/scanner.js` | 파일 시스템 트리 순회 — symlink loop / 권한 오류 처리 |
| `src/services/restoreService.js` | mask → 원본 복원 — 잘못된 매핑 시 시크릿 누출 |
| `src/services/protectionService.js` | 소스코드 in-place 수정 — 백업 / rollback 메타 신뢰성 |

## 의존성 정책

- `npm audit --production` 결과 high/critical 0 유지
- Dependabot 주간 업데이트 (`.github/dependabot.yml`) — patch/minor 도 PR 리뷰 후 머지
- `tree-sitter-wasms`, `web-tree-sitter` 처럼 native binding 의존성은 그룹화 업데이트

## 보안 관련 최근 변경

자세한 이력은 [CHANGELOG.md](./CHANGELOG.md) 참고.

- 2026-04-30: PlistBuddy 인자 escape, customPatterns ReDoS 가드, .blinderSettings 스키마 검증
