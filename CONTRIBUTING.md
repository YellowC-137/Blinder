# Contributing to Blinder 🛡️

[🇰🇷 한국어](#한국어-기여-가이드) | [🇺🇸 English](#english-contribution-guide)

---

## English Contribution Guide

Thank you for your interest in contributing to Blinder! We welcome contributions to support new platforms, fix bugs, or improve documentation.

### 🛠️ Plugin Scaffolding (Recommended)

Blinder provides a scaffolding command to help you start developing a new platform plugin in seconds.

```bash
npm run generate-plugin
```

This command will:
1. Ask for basic platform info (ID, Name, Category, etc.).
2. Generate a minimal plugin file in `src/platforms/<category>/<id>.js`.
3. Automatically register the plugin in `src/platforms/index.js`.

### 🔌 Platform Development Guide

#### 1. Minimal Template
A basic plugin only needs a `detect` logic and an `auto-fix` replacement rule.

```javascript
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'ruby',
  name: 'Ruby',
  category: 'backend',
  detect: async (repoPath) => fs.existsSync(path.join(repoPath, 'Gemfile')),
  commonExtensions: ['.rb'],
  getAutoFixReplacement: (match, envVarName) => `ENV["${envVarName}"]`
});
```

#### 2. Using `definePlatform`
Always wrap your configuration with `definePlatform()`. It provides:
- **Default Values**: Automatically sets up common regexes and empty arrays for optional fields.
- **IDE Support**: Provides JSDoc-based autocompletion for all available properties.

#### 3. Advanced Features
For complex integrations (like iOS or Android), you can implement:
- `setupBridge`: Logic to inject `.env` loading into build systems.
- `applyAdvancedFix`: Multi-stage code transformation logic.
- `preFix` / `postFix`: Lifecycle hooks for setup/cleanup.

### ✅ Testing Your Plugin

```bash
# Verify platform detection
blinder scan --path /path/to/test-project --dry-run

# Verify auto-fix logic
blinder blind --path /path/to/test-project --dry-run -y
```

---

## 한국어 기여 가이드

Blinder 프로젝트에 관심을 가져주셔서 감사합니다! 새로운 플랫폼 지원, 버그 수정, 문서 개선 등 모든 종류의 기여를 환영합니다.

### 🛠️ 플러그인 자동 생성 (권장)

새로운 플랫폼을 추가하고 싶다면, 아래 명령어를 통해 몇 초 만에 개발을 시작할 수 있습니다.

```bash
npm run generate-plugin
```

이 명령어는 다음 작업을 수행합니다:
1. 플랫폼 기본 정보(ID, 이름, 카테고리 등)를 묻습니다.
2. `src/platforms/<category>/<id>.js` 경로에 최소 기능 템플릿을 생성합니다.
3. `src/platforms/index.js` 레지스트리에 자동으로 등록합니다.

### 🔌 플랫폼 개발 가이드

#### 1. 최소 템플릿
기본적인 플러그인은 프로젝트 감지 로직(`detect`)과 환경 변수 치환 규칙(`getAutoFixReplacement`)만 있으면 됩니다.

```javascript
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'ruby',
  name: 'Ruby',
  category: 'backend',
  detect: async (repoPath) => fs.existsSync(path.join(repoPath, 'Gemfile')),
  commonExtensions: ['.rb'],
  getAutoFixReplacement: (match, envVarName) => `ENV["${envVarName}"]`
});
```

#### 2. `definePlatform` 사용
플러그인 설정을 작성할 때 반드시 `definePlatform()`으로 감싸주세요.
- **기본값 제공**: 주석 정규식이나 빈 리스트 등 선택적 속성들을 자동으로 채워줍니다.
- **IDE 지원**: 모든 속성에 대해 JSDoc 기반의 자동 완성을 제공합니다.

#### 3. 고급 기능
복잡한 연동이 필요한 경우 아래 메서드들을 구현할 수 있습니다.
- `setupBridge`: 빌드 시스템에 `.env` 연동 코드를 주입하는 로직.
- `applyAdvancedFix`: 단순 치환으로 안 되는 복잡한 코드 변환 로직.
- `preFix` / `postFix`: 파일 수정 전/후 실행되는 생명주기 훅.

### ✅ 플러그인 검증

```bash
# 플랫폼 감지 확인
blinder scan --path /path/to/test-project --dry-run

# Auto-fix 로직 확인
blinder blind --path /path/to/test-project --dry-run -y
```
