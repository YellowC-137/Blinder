# Blinder 🛡️

[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_en.md)

**Blinder** is an automated security tool for the AI era designed to prevent sensitive information in your source code from leaking when using AI agents (Cursor, ChatGPT, Claude, etc.).

From mobile (iOS, Android, Flutter) to backend (Spring Boot, Node.js, etc.), Blinder uses a **plugin architecture** to detect hardcoded API keys across all platforms and process them safely through one of two workflows (`blind` or `mask`).

---

## ✨ Key Features

- **🔍 AST-Based Precision Engine (Phase-Gate)**: Goes beyond simple regex by using `web-tree-sitter` AST analysis to verify actual string literals. Significantly reduces false positives in comments or non-code areas. (Prioritized for iOS/Android/Flutter)
- **⚡ Hybrid I/O Optimization**: Switches between `readFileSync` and `readline` streams based on file size to minimize memory overhead in large projects.
- **🛡️ Auto Environment Variable Conversion (Auto-fix)**: Moves detected secrets to `.env` and replaces them with platform-specific accessors (Dart, Kotlin, Swift, Obj-C, Java, etc.).
- **🔌 Plugin Architecture**: Add new languages and frameworks easily by inheriting from `BasePlatform`.
- **📜 Multi-line Secret Detection**: Detects multi-line sensitive data such as PEM Private Keys and certificates.
- **📊 Automated Reports & CI Support**: Saves scan history to `blinder_reports/`. Pipeline integration via `--ci` / `-y` modes.
- **🗝️ Structured-File Detection + Whitelist**: Parses Info.plist, AndroidManifest meta-data, gradle.properties, etc. at the key level — only SDK keys are eligible for auto-fix (system keys are auto-excluded).

---

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/YellowC-137/Blinder.git
cd Blinder
npm install
sudo npm link
```

OR

```bash
npm install -g github:YellowC-137/Blinder
```

---

## 🔀 Two Workflows Compared

| | `blind` workflow | `mask` workflow |
|---|---|---|
| **Purpose** | Move secrets to `.env`, **keep code executable** | Strip all secrets so AI sees only business logic |
| **Original code** | Modified directly (env accessors injected) | Untouched (separate copy created) |
| **Output buildable?** | ✅ Yes (with `bridge` setup) | ❌ **No — read-only** |
| **Use case** | Production / team sharing / Git commits | AI code review / SDK analysis / external sharing |
| **Paired commands** | `blinder blind` ↔ `blinder rollback` | `blinder mask` ↔ `blinder restore` |
| **Handling AI edits** | Use as-is (just ensure env loading) | Merge back to source via `restore` |

---

## 📋 Command Guide

Commands are **grouped by purpose**, with paired undo/merge commands inside each group.

### 🟦 Group A: `blind` workflow — keep code executable

> Modify the original source to extract secrets into `.env`. Build system is auto-wired so the project still builds and runs.

#### A-1. `blinder blind` — extract secrets + auto-replace
Detect secrets → generate `.env` → rewrite source with env accessors → update `.gitignore`. (`scan` + `protect` + `gitignore` combined)
- **Interactive mode**: Reviews target file list and prompts for additional folder exclusions (e.g., third-party SDKs).
- `-y, --yes`: Auto-answers all prompts. Suitable for CI/CD.
- `--dry-run`: Preview changes without modifying files.

> [!CAUTION]
> **Modifies original source directly**: Build-critical files like `build.gradle`, `.pbxproj`, `Info.plist` are rewritten. **Always `git commit` first.**

#### A-2. `blinder bridge` — build system integration
Wire each platform's build system to read from `.env`. Calls each plugin's `setupBridge()`.
- **Android**: Auto-injects `BuildConfig` fields into `app/build.gradle` + registers `manifestPlaceholders`.
- **iOS (Native + Flutter)**: Adds a `post_install` hook to the `Podfile`. `pod install` then configures the 'Blinder Env Loader' Run Script Phase automatically.
- **Flutter**: Adds `--dart-define-from-file=.env` to VS Code/IntelliJ run configs + generates an `f.sh` CLI wrapper.

> [!WARNING]
> **iOS without a Podfile (manual setup required)**: Follow the `blinder-ios-setup.sh` guide and register the script in Xcode `Build Phases` manually. **Uncheck 'Based on dependency analysis'** and **set 'User Script Sandboxing' to NO** — both are mandatory.

#### A-3. `blinder rollback` — undo `blind` (paired with A-1)
Reverts env-accessor replacements made by `blind`/`protect` back to the hardcoded original. Uses `.blinder_protect.json` metadata for exact-position restoration. Optionally bulk-deletes Blinder-generated files (.env, gitignore additions, etc.).

> [!IMPORTANT]
> Loss/corruption of `.blinder_protect.json` makes exact-position restore impossible — `git commit` immediately after `blind`.

---

### 🟩 Group B: `mask` workflow — for sharing with AI (NOT executable)

> Leave the original code untouched and produce a **masked copy**. All secrets and sensitive files are stripped so AI reads only business logic.

#### B-1. `blinder mask` — generate AI-shareable copy
Copies the entire project (or a specified subdirectory) to `maskedProject_<projectName>/`. All secrets are replaced with `__BLINDER_VAR__` tokens. The following are **completely excluded** from the copy:
- SSH/PGP/TLS keys, certificates (`*.pem`, `*.p12`, `id_rsa`, ...)
- Cloud / package manager credentials (`.aws/credentials`, `.npmrc`, `.kube/config`, ...)
- Build artifacts (`*.apk`, `*.ipa`, `*.dSYM`, `xcuserdata/`, ...)
- Env variants (`.env.local`, `.env.production`, ...)
- Backups / IDE temp files (`*.bak`, `.idea/workspace.xml`, ...)
- DB dumps, compile outputs, archives

A `.blinder_map.json` is saved inside the copy and used by `restore` to map secrets back.

> [!CAUTION]
> ## 🚨 `mask` Output is **NOT Executable** 🚨
> - ❌ **Never attempt to build or run** — every secret is replaced with `__BLINDER_VAR__`, causing compile errors or runtime NPEs.
> - ❌ **Never deploy a masked copy** to any real environment.
> - ❌ **Never ask the AI to "build and verify"** — the build will fail.
> - ✅ **Read-only** — for AI to understand structure/logic, suggest refactors, diagnose bugs.
> - ✅ **Merge AI edits back via `blinder restore`** (secrets are auto-restored at that point).
>
> If you need an executable workflow, use `blinder blind` instead.

> [!NOTE]
> **Why use `mask` instead of just restricting `.env` access?**
> 1. **Non-invasive**: `blind` modifies your source. `mask` creates a separate physical copy with the original untouched.
> 2. **External sharing**: When zipping code for ChatGPT Web or external collaborators, you need a folder where secrets are physically removed.
> 3. **Execution log leak prevention**: Building/running real code may print in-memory secrets to logs/errors. A masked copy can't build at all — eliminates this risk at the source.
> 4. **Git history protection**: Blocking file access alone doesn't stop AI from reading hardcoded secrets in older commits.

#### B-2. `blinder restore` — merge AI edits back (paired with B-1)
Safely brings **all code changes + new files** the AI made in the masked copy back into the original project. `__BLINDER_VAR__` tokens are auto-restored to real secrets. Includes auto-fixups for missing imports, etc.

> [!WARNING]
> If `.blinder_map.json` inside the masked copy is corrupted or deleted, secrets cannot be restored. Don't ask the AI to "clean up the map file."

---

### 🟨 Group C: utility commands

#### C-1. `blinder scan` — manual scan (no modification)
Detect secrets + generate detailed report. No code changes.
- `--ci`: Non-zero exit on detection → blocks CI pipelines.
- `-o <file>`: Write JSON output.

#### C-2. `blinder gitignore` — augment `.gitignore`
Adds detected platform-specific templates (.env, build/, *.jks, ...) + Blinder-generated files to `.gitignore`.

#### C-3. `blinder help` — help
Prints all commands and options.

---

## 🛠️ Project Configuration (`.blinderSettings`)

Customize behavior by creating `.blinderSettings` (JSON) in the project root. Use this to safely exclude third-party SDKs and proprietary security libraries.

### Options
- `ignorePaths`: Glob patterns excluded from scan + Auto-fix
- `customPatterns`: Project-specific secret patterns (Regex + severity)
- `maskOutput`: Output folder name for `mask` (default: `maskedProject_<projectName>`)

### Example

```json
{
  "ignorePaths": [
    "Library/RSKSW/**",
    "Library/mVaccine/**",
    "**/test/mocks/**"
  ],
  "customPatterns": [
    { "name": "Internal API", "regex": "INTERNAL_[A-Z]{3}_KEY_[0-9a-f]{32}", "severity": "CRITICAL" }
  ],
  "maskOutput": ".blinder_masked_project"
}
```

> [!TIP]
> **Heuristic auto-protection**: Even without configuration, files containing `Copyright`, `SDK`, or `Third-party` near the top are recognized as external libraries and skipped automatically.

---

## 🔧 Platform-Specific Auto-fix Examples (`blind` workflow)

| Platform | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter (Dart)** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android (Kotlin/Java)** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS (Swift)** | `"glpat...789"` | `(Bundle.main.object(forInfoDictionaryKey: "GITLAB_TOKEN") as? String ?? "")` |
| **iOS (Obj-C)** | `NSString *const API_URL = @"..."` | `#define API_URL [[NSBundle mainBundle] objectForInfoDictionaryKey:@"API_URL"]` |

### ⚠️ Platform-Specific Auto-fix Caveats

> The `mask` workflow only does token substitution, so language constraints don't apply. Caveats below are **`blind` (Auto-fix) only**.

#### 🍎 iOS (Objective-C)
- **Global constants**: `NSString *const` cannot use runtime functions due to C compile-time constraints → Blinder auto-migrates to `#define` macros.
- **Note**: Primitive constants (`int`, `double`, etc.) are excluded from Auto-fix. Handle manually if needed.

#### 🍏 iOS (Swift)
- Swift supports runtime evaluation → `Bundle.main.object(forInfoDictionaryKey:...)` injection works.
- **Note**: For real values at runtime, `.xcconfig` + `Info.plist` must be wired to read `.env`. → `blinder bridge` automates this.

#### 🤖 Android (Kotlin / Java)
- Default replacement: `BuildConfig.VARIABLE_NAME`. To compile, `build.gradle` needs a BuildConfig generation script → `blinder bridge` injects it.
- `.xml` files (e.g., `AndroidManifest.xml`): `${VARIABLE_NAME}` placeholder substitution. Requires `manifestPlaceholders` registration → handled by bridge.

#### 🦋 Flutter (Dart)
- Replaced with `String.fromEnvironment('VAR')`.
- **Required**: Pass `--dart-define-from-file=.env` at build/run time. → bridge auto-adds it to IDE configs and the `f.sh` wrapper.

### 🛡️ Structured-File Auto-fix Policy (Safety Net)

`Info.plist`, `AndroidManifest.xml`, `gradle.properties` are auto-fixed only against a key-name whitelist:

| File | Auto-fix targets (whitelist) | Blocked (blacklist) |
|---|---|---|
| Info.plist | `KAKAO_*`, `NAVER_*`, `GMSApiKey`, `FacebookAppID`, `*_API_KEY`, etc. | `CFBundle*`, `NS*`, `UI*`, `LS*` system keys |
| AndroidManifest meta-data | `com.kakao.sdk.*`, `com.google.android.geo.API_KEY`, etc. | `androidx.*`, `com.google.android.gms.version` |
| gradle.properties | Keys hinting `API_KEY`/`TOKEN`/`PASSWORD` | `org.gradle.*`, `android.*`, `kotlin.*` |
| local.properties | (permanently blocked) | All keys — gitignored |
| .xcconfig | (permanently blocked — self-reference risk) | All keys |

Keys outside the whitelist are detected but never auto-fixed — only flagged with a warning to the user.

---

## 🔌 Adding a New Platform Plugin (Plugin Architecture)

Add support for new languages and frameworks without touching the core engine.

### Quick Start: CLI Scaffolding

```bash
blinder add_platform
```

Interactive prompts generate the plugin file and register it automatically. Choose a category (Backend, Frontend, Mobile) or define a Custom one. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### Manual: Minimal Template

```javascript
// src/platforms/backend/python.js
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

Register in `src/platforms/index.js`:

```javascript
import python from './backend/python.js';

export const platforms = [
  common, ios, android, flutter,
  python
];
```

### Verify

```bash
blinder scan --path /your/python-project --dry-run
blinder blind --path /your/python-project --dry-run -y
```

<details>
<summary><strong>📖 Advanced Plugin API (Bridge, Advanced Fix, Lifecycle Hooks)</strong></summary>

#### Complete IPlatform Interface

| Property / Method | Type | Required | Description |
|:---|:---|:---:|:---|
| `id` | `string` | ✅ | Unique identifier |
| `name` | `string` | ✅ | Display name |
| `category` | `string` | ✅ | `core` / `mobile` / `backend` / `web` |
| `detect(repoPath)` | `async → bool` | ✅ | Project type detection |
| `commonExtensions` | `string[]` | ✅ | Extensions to scan |
| `sensitiveFiles` | `object[]` | | Sensitive files (`glob`, `severity`, `reason`) |
| `commentRegex` | `RegExp` | | Comment-line regex |
| `ignorePaths` | `string[]` | | Scan-excluded paths |
| `getGitignoreTemplate()` | `→ string` | | .gitignore section |
| `getAutoFixReplacement(match, envVarName, ext, options)` | `→ string` | | Env-variable accessor |
| `applyAdvancedFix(context)` | `→ object` | | Complex transform (Stage 1) |
| `preFix(context)` | `async` | | Pre-modification hook |
| `postFix(context)` | `async` | | Post-modification hook |
| `setupBridge(repoPath)` | `async` | | Build system integration |
| `teardownBridge(repoPath)` | `async` | | Integration teardown |
| `testCases` | `object[]` | | Validation cases |

#### Lifecycle Execution Order

```text
┌─────────────────────────────────────────────────┐
│ protect.js: applyAutoFixes()                    │
│                                                 │
│  for each file:                                 │
│    1. preFix()          ← Prepare              │
│    2. for each secret:                          │
│       a. applyAdvancedFix()  ← Stage 1 (Adv.)  │
│       b. getAutoFixReplacement() ← Stage 2     │
│    3. postFix()         ← Cleanup              │
└─────────────────────────────────────────────────┘
```

#### Advanced Example (Spring Boot)

```javascript
import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'springboot',
  name: 'Spring Boot',
  category: 'backend',

  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'pom.xml')) ||
           fs.existsSync(path.join(repoPath, 'build.gradle'));
  },

  commonExtensions: ['.java', '.properties', '.yml', '.yaml', '.xml'],

  sensitiveFiles: [
    { glob: '**/application-secret.yml', severity: 'CRITICAL', reason: 'Production DB/API keys' },
    { glob: '**/application-prod.properties', severity: 'HIGH', reason: 'Production env settings' }
  ],

  ignorePaths: ['**/target/**', '**/.mvn/**', '**/build/**'],

  getGitignoreTemplate: () => `
# Spring Boot
target/
*.jar
*.war
application-secret.yml
`,

  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.java') return `System.getenv("${envVarName}")`;
    if (ext === '.properties' || ext === '.yml') return `\${${envVarName}}`;
    return `process.env.${envVarName}`;
  }
});
```

</details>

---

## ⚠️ Common Precautions

> [!IMPORTANT]
> **`git commit` before any Blinder command**: So you can review modifications and revert quickly if needed.

> [!WARNING]
> **Managing `.env` files**: Blinder auto-adds `.env` to `.gitignore`, but verify manually before final commit that `.env` is not tracked.

> [!WARNING]
> **Vendor library build impact**: In-house security libraries (KeySharp, RSKSW, etc.) may have constraints (key-length checks, etc.). Recommended to exclude them via `.blinderSettings` `ignorePaths` first.
