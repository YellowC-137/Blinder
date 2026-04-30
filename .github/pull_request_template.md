<!--
  본 템플릿은 자동으로 PR 본문에 들어갑니다.
  해당 없는 섹션은 삭제하세요.
-->

## 요약

<!-- 한두 문장. WHY 중심. WHAT 은 diff 가 말함. -->

## 변경 종류

- [ ] 🐛 Bug fix (사용자 영향 있음, breaking 아님)
- [ ] ✨ Feature (사용자 노출 신규 기능)
- [ ] ♻️ Refactor (동작 동일, 내부 구조 변경)
- [ ] 🔒 Security (보안 패치 — `SECURITY.md` 워크플로 따름)
- [ ] 📝 Docs / Test / CI
- [ ] 💥 Breaking change (API/CLI 시그니처 변경)

## 영향 받는 플랫폼 플러그인

- [ ] common
- [ ] ios
- [ ] android
- [ ] flutter
- [ ] react (CRA / Vite / Next)
- [ ] node
- [ ] java / springboot
- [ ] ruby
- [ ] 해당 없음

## 검증

- [ ] `npm test` 통과
- [ ] `npm run test:integration` 통과
- [ ] 변경 영역 회귀 테스트 추가 또는 갱신
- [ ] 영향 받는 플랫폼 회귀 (`npm run test:regression:<platform>`) 통과 — 또는 사유 기재
- [ ] DEBUG=1 로 수동 smoke test 1회 이상

## 보안 / 사용자 데이터 영향

<!-- 시크릿 보호 도구라 이 섹션 필수 -->

- [ ] 사용자 시크릿이 새 경로(로그/파일/네트워크)로 흐를 가능성 0
- [ ] mask / restore 라운드트립 손상 없음 — 또는 명시적 마이그레이션 추가
- [ ] 사용자 입력(.blinderSettings, customPatterns 등) 검증 추가/유지

해당 없음 사유:

## breaking change 마이그레이션 (해당 시)

<!-- CLI 시그니처 / 파일 포맷 / 환경변수 / 플러그인 인터페이스 변경 시 사용자 액션 명시 -->

## CHANGELOG

- [ ] `CHANGELOG.md` 의 `[Unreleased]` 섹션에 항목 추가했음

## 관련 이슈

Closes #
