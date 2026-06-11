# 🔌 신규 플랫폼 추가 가이드 (Plugin Architecture)

코어 엔진 수정 없이 새 언어/프레임워크 지원 가능. 풀 가이드 + 트러블슈팅: [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 플러그인이 하는 일

각 언어/프레임워크를 **플러그인 1개 = 파일 1개**로 표현. 코어 엔진은 언어 규칙을 모르고, 플러그인이 다음을 알려줌:

| 책임 | 메서드 |
|---|---|
| 이 프로젝트가 내 플랫폼인가? | `detect(repoPath)` |
| 어떤 확장자 스캔할 건가? | `commonExtensions` |
| 시크릿 발견 시 무엇으로 치환할 건가? | `getAutoFixReplacement(match, envVarName, ext)` |
| (선택) `.env`를 빌드 시스템에 어떻게 연동? | `setupBridge(repoPath)` / `teardownBridge(repoPath)` |
| (선택) 단순 치환으로 안 되는 케이스? | `applyAdvancedFix(context)` |

플러그인 파일 작성 → `src/platforms/index.ts` 등록 → 끝. (코드베이스는 TypeScript strict 모드)

---

## 가장 빠른 길: CLI 스캐폴더

```bash
blinder add_platform
```

대화형으로 5가지 입력:

| 입력 | 의미 | 예시 |
|---|---|---|
| Platform ID | 내부 식별자 + 파일명 | `django` |
| 표시명 | 사용자에게 보이는 이름 | `Django` |
| Category | Backend / Frontend / Mobile / Custom | `Backend` |
| 스캔 확장자 | 콤마 구분 | `.py,.html` |
| 감지 파일 | `detect()` 마커 | `manage.py` |

자동 동작:
1. `src/platforms/<category>/<id>.ts` 템플릿 생성 — 첫 확장자 기준 env 접근자 자동 선택:

| 첫 확장자 | 자동 접근자 |
|---|---|
| `.py` | `os.environ.get("VAR")` |
| `.rb` | `ENV["VAR"]` |
| `.java` / `.kt` | `System.getenv("VAR")` |
| `.go` | `os.Getenv("VAR")` |
| `.rs` | `std::env::var("VAR").unwrap_or_default()` |
| `.php` | `getenv('VAR')` |
| 그 외 | `process.env.VAR` |

2. `src/platforms/index.ts`에 import + 배열 항목 자동 추가. (import 경로는 NodeNext ESM 규칙에 따라 `.js` 확장자로 표기 — TS 소스를 가리킴)

---

## 최소 템플릿 (직접 작성)

`detect`, `commonExtensions`, `getAutoFixReplacement`만 있으면 동작:

```typescript
// src/platforms/backend/python.ts
import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'python',
  name: 'Python',
  category: 'backend',
  detect: async (repoPath) => fs.existsSync(path.join(repoPath, 'requirements.txt')),
  commonExtensions: ['.py'],
  getAutoFixReplacement: (match, envVarName) => `os.environ.get("${envVarName}")`
});
```

`src/platforms/index.ts`에 등록:

```typescript
import python from './backend/python.js';

export const platforms = [
  common, ios, android, flutter, ruby,
  python
];
```

> [!TIP]
> `definePlatform()`은 필수 필드(`id`, `name`, `detect`, `commonExtensions`)를 로드 시점에 검증하고 누락 시 즉시 throw. 옵셔널 훅은 안전한 기본값으로 채워짐.

---

## 전체 IPlatform 인터페이스

| 속성/메서드 | 타입 | 필수 | 설명 |
|:---|:---|:---:|:---|
| `id` | `string` | ✅ | 고유 식별자 |
| `name` | `string` | ✅ | 표시명 |
| `category` | `string` | ✅ | `core` / `mobile` / `backend` / `web` |
| `detect(repoPath)` | `async → bool` | ✅ | 프로젝트 유형 판별 |
| `commonExtensions` | `string[]` | ✅ | 스캔 대상 확장자 |
| `sensitiveFiles` | `object[]` | | 민감 파일 (`glob`, `severity`, `reason`) |
| `commentRegex` | `RegExp` | | 주석 행 판별 |
| `ignorePaths` | `string[]` | | 스캔 제외 경로 |
| `getGitignoreTemplate()` | `→ string` | | .gitignore 섹션 |
| `getAutoFixReplacement(...)` | `→ string` | | 환경변수 접근자 |
| `applyAdvancedFix(context)` | `→ object` | | 복잡 변환 (Stage 1) |
| `preFix(context)` | `async` | | 수정 전 훅 |
| `postFix(context)` | `async` | | 수정 후 훅 |
| `setupBridge(repoPath)` | `async` | | 빌드 시스템 연동 |
| `teardownBridge(repoPath)` | `async` | | 연동 해제 |
| `testCases` | `object[]` | | 검증 케이스 |

---

## 라이프사이클 실행 순서

```text
┌─────────────────────────────────────────────────┐
│ protect.js: applyAutoFixes()                    │
│                                                 │
│  for each file:                                 │
│    1. preFix()          ← 수정 전 준비           │
│    2. for each secret:                          │
│       a. applyAdvancedFix()  ← Stage 1 (고급)   │
│       b. getAutoFixReplacement() ← Stage 2      │
│    3. postFix()         ← 수정 후 후처리         │
└─────────────────────────────────────────────────┘
```

---

## 검증

```bash
# 유닛 + 파서 + 분류기 테스트
npm test

# 타입 체크 + 레지스트리 파싱 확인
npx tsc --noEmit
node --import tsx -e "import('./src/platforms/index.ts').then(m => console.log(m.platforms.map(p => p.id)))"

# 플랫폼 감지 + Auto-fix 미리보기
blinder scan --path /your/project --dry-run
blinder blind --path /your/project --dry-run -y
```

---

## 자주 만나는 함정

| 증상 | 해결 |
|---|---|
| `Platform plugin must have an "id" property.` | 필수 필드(`id`/`name`/`detect`/`commonExtensions`) 채우기 |
| 파일은 생성됐는데 동작 안함 | `index.ts`에 import + 배열 등록 누락 |
| `Detected platforms`에 안 나타남 | `detect()`가 false. 마커 파일은 **repo 루트** 기준 |
| 주석 안 시크릿까지 치환 | `commentRegex` 오버라이드 |
| `blind` 후 빌드 깨짐 | `setupBridge()` 구현 필요 |
| `rollback` 후 bridge 잔존 | `teardownBridge()` 짝 작성 필수 |
