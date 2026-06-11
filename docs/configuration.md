# 🛠️ 프로젝트 설정 (`.blinderSettings`)

프로젝트 루트에 `.blinderSettings` (JSON) 생성으로 동작 커스터마이즈 가능. 외부 SDK / 보안 라이브러리는 이 설정으로 안전하게 제외.

---

## 옵션

| 키 | 타입 | 설명 |
|---|---|---|
| `ignorePaths` | `string[]` | 스캔 + Auto-fix 제외 경로 (Glob) |
| `customPatterns` | `object[]` | 프로젝트 고유 시크릿 패턴 (Regex + severity) |
| `maskOutput` | `string` | `mask` 결과 폴더명 (기본: `maskedProject_<projectName>`) |

> [!NOTE]
> `customPatterns` 정규식은 등록 시 ReDoS 가드(`regexGuard`)가 검증합니다 — nested quantifier(`(a+)+`), 연속 `.*`/`.+`, 50ms 초과 worst-case 매칭은 거부되고 경고 후 건너뜁니다. `g` 플래그는 자동으로 부여되므로 패턴에 직접 쓸 필요 없습니다.

---

## 예시

```json
{
  "ignorePaths": [
    "Library/myCustomSDK/**",
    "**/test/mocks/**"
  ],
  "customPatterns": [
    { "name": "Internal API", "regex": "INTERNAL_[A-Z]{3}_KEY_[0-9a-f]{32}", "severity": "CRITICAL" }
  ],
  "maskOutput": ".blinder_masked_project"
}
```

> [!TIP]
> **휴리스틱 자동 보호**: 별도 설정 없이도 파일 상단에 `Copyright`, `SDK`, `Third-party` 문구가 있으면 외부 라이브러리로 인식하여 자동 제외.

---

## severity 레벨

| 레벨 | 설명 |
|---|---|
| `CRITICAL` | 즉시 회전(rotate) 필요. 운영 환경 키 등. |
| `HIGH` | 높은 위험도. 외부 서비스 인증 토큰 등. |
| `MEDIUM` | 중간 위험도. 내부 API 키 등. |
| `LOW` | 낮은 위험도. 개발용 키 등. |

---

## 메타데이터 파일

Blinder가 생성하는 로컬 메타데이터 파일은 절대 git에 올리지 마세요.

| 파일 | 위치 | 용도 |
|---|---|---|
| `.blinder_protect.json` | 프로젝트 루트 | `blind` 실행 위치 정보 → `rollback` 복원에 사용 |
| `.blinder_maps/<사본폴더명>.json` | 프로젝트 루트 | `mask` 시크릿 매핑 → `restore` 복원에 사용 |

매핑 파일에는 **원본 시크릿 값이 그대로** 들어 있으므로 마스킹 사본 밖(프로젝트 루트)에 저장됩니다 — 사본 폴더를 통째로 공유해도 시크릿이 유출되지 않습니다. 구버전 Blinder가 사본 안에 만든 `.blinder_map.json` 도 `restore` 가 계속 인식합니다.

모두 Blinder가 `.gitignore`에 자동 추가합니다. `restore`/`rollback` 완료 전에는 로컬에서 절대 삭제하지 마세요.
