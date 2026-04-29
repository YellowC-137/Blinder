<div align="center">

# Blinder 🛡️

**Secret protection for the AI era — keep your code, lose the secrets.**

[🇰🇷 한국어](./README.md) · [🇺🇸 English](./README_en.md) · [Contributing](./CONTRIBUTING.md)

[![Node.js](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Flutter%20%7C%20Node%20%7C%20Spring%20%7C%20React%20%7C%20Ruby-orange.svg)](#-supported-platforms--languages)
[![Plugin Architecture](https://img.shields.io/badge/architecture-plugin--based-purple.svg)](#-adding-a-new-platform-plugin-plugin-architecture)
[![CI Ready](https://img.shields.io/badge/CI-ready-success.svg)](#-group-c-utility-commands)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

> **Blinder** prevents hardcoded API keys, credentials, and certificates from leaking when you hand source code to AI agents (Cursor, ChatGPT, Claude, …).
>
> From mobile (iOS · Android · Flutter) to backend (Spring Boot · Node.js · Java · Ruby) and frontend (React/CRA/Vite/Next.js) — Blinder uses a **plugin architecture** to cover every platform, with two safe workflows: `blind` (extract to `.env` for production) or `mask` (read-only copy for AI sharing).

---

## 📑 Table of Contents

- [Why Blinder?](#-why-blinder)
- [60-Second Quickstart](#-60-second-quickstart)
- [Supported Platforms / Languages](#-supported-platforms--languages)
- [Key Features](#-key-features)
- [Installation](#-installation)
- [Two Workflows Compared](#-two-workflows-compared)
- [Command Guide](#-command-guide)
- [Project Configuration (`.blinderSettings`)](#%EF%B8%8F-project-configuration-blindersettings)
- [Platform-Specific Auto-fix Examples](#-platform-specific-auto-fix-examples-blind-workflow)
- [Comparison with Alternatives](#-comparison-with-alternatives)
- [FAQ](#-faq)
- [Adding a New Platform Plugin](#-adding-a-new-platform-plugin-plugin-architecture)
- [Common Precautions](#-common-precautions)
- [Contributing · License](#-contributing--license)

---

## 🤔 Why Blinder?

Now that AI coding agents are part of every dev's workflow, the most common leak scenarios look like this:

| Risk Scenario | How Blinder Solves It |
|---|---|
| 🪣 **Sharing a folder "minus `.env`"** — yet hardcoded keys in source still ship | `blind` extracts plain-text keys into `.env` + auto-rewrites with env accessors |
| 🤖 **Asking AI to "refactor"** — partial keys end up quoted in answers and flow into external training data | `mask` produces a **read-only copy** with all secrets replaced by `__BLINDER_VAR__` tokens |
| 🧨 **Worried about breaking the build** — moving keys to `.env` means hand-wiring `BuildConfig` / `Info.plist` / `dart-define` | `bridge` idempotently injects per-platform build-system wiring |
| 🔁 **Merging AI's edits back** — manually flipping tokens back to real secrets is error-prone | `restore` auto-restores from `.blinder_map.json` + auto-fixes missing imports |
| 🚨 **Need a CI/CD gate** — block PRs that introduce hardcoded secrets | `scan --ci` returns non-zero exit code for pipeline gating |

**One-liner**: detection (scan) + safe production extraction (blind/bridge/rollback) + AI-shareable masking (mask/restore) — all in **one CLI**.

---

## ⚡ 60-Second Quickstart

```bash
# 1) Install
npm install -g github:YellowC-137/Blinder

# 2) Move into your project
cd /path/to/your/project

# 3) Safe preview (no file changes)
blinder scan --dry-run

# 4-A) Production: extract secrets to .env and wire build system
blinder blind            # rewrite source + create .env + augment .gitignore
blinder bridge           # wire BuildConfig / Podfile / dart-define / etc.

# 4-B) Or AI-sharing: produce a masked read-only copy
blinder mask             # creates maskedProject_<projectName>/

# 5) Need to undo?
blinder rollback         # revert blind back to hardcoded source
blinder restore          # merge AI-edited mask copy back + auto-restore tokens
```

> [!IMPORTANT]
> **Always `git commit` before running any command.** Blinder modifies build-critical files (`build.gradle`, `Podfile`, `Info.plist`, `.pbxproj`).

---

## 🧩 Supported Platforms / Languages

| Platform | Category | Detection file | Scan extensions | Status |
|---|---|---|---|:---:|
| **iOS** (Swift / Obj-C) | mobile | `*.xcodeproj`, `Podfile`, `Package.swift` | `.swift`, `.m`, `.h`, `.mm`, `.plist`, `.xcconfig` | ✅ Stable |
| **Android** (Kotlin / Java) | mobile | `build.gradle`, `AndroidManifest.xml` | `.kt`, `.java`, `.xml`, `.gradle`, `.properties`, `.json` | ✅ Stable |
| **Flutter** (Dart) | mobile | `pubspec.yaml` | `.dart`, `.yaml` | ✅ Stable |
| **Common** (cross-platform) | core | (every project) | `.env`, `.json` | ✅ Stable |
| **Node.js** | backend | `package.json` (no frontend deps) | `.js`, `.mjs`, `.cjs`, `.ts` | ✅ Stable |
| **Java** | backend | `pom.xml` or `build.gradle` (excl. Spring/Android) or `src/main/java/` | `.java`, `.properties`, `.xml` | ✅ Stable |
| **Spring Boot** | backend | `pom.xml`(spring-boot-starter) or `build.gradle`(`org.springframework.boot`) | `.java`, `.kt`, `.properties`, `.yml`, `.yaml`, `.xml` | ✅ Stable |
| **React** (CRA / Vite / Next.js) | frontend | `package.json` (`react` deps) | `.js`, `.jsx`, `.ts`, `.tsx` | ✅ Stable |
| **Ruby** | backend | `Gemfile` | `.rb` | 🧪 Beta (community PRs welcome) |

**Structured-file auto-fix** (default-deny + whitelist gating): Info.plist · AndroidManifest meta-data · `gradle.properties` · `local.properties` (permanently blocked) · `.xcconfig` (permanently blocked)

> To add a new platform, see [Adding a New Platform Plugin](#-adding-a-new-platform-plugin-plugin-architecture) or [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## ✨ Key Features

- **🔍 AST-Based Precision Engine (Phase-Gate)**: Goes beyond simple regex by using `web-tree-sitter` AST analysis to verify actual string literals. Significantly reduces false positives in comments or non-code areas. (Prioritized for iOS/Android/Flutter)
- **⚡ Hybrid I/O Optimization**: Switches between `readFileSync` and `readline` streams based on file size to minimize memory overhead in large projects.
- **🛡️ Auto Environment Variable Conversion (Auto-fix)**: Moves detected secrets to `.env` and replaces them with platform-specific accessors (Dart, Kotlin, Swift, Obj-C, Java, etc.).
- **🔌 Plugin Architecture**: Add new languages and frameworks easily by inheriting from `BasePlatform`. The core engine knows zero language rules.
- **🌉 Auto Bridge Integration**: Idempotently injects/removes build-system wiring (BuildConfig · Podfile post_install · dart-define-from-file).
- **📜 Multi-line Secret Detection**: Detects multi-line sensitive data such as PEM Private Keys and certificates.
- **📊 Automated Reports & CI Support**: Saves scan history to `blinder_reports/`. Pipeline integration via `--ci` / `-y` modes.
- **🗝️ Structured-File Detection + Whitelist**: Parses Info.plist, AndroidManifest meta-data, gradle.properties, etc. at the key level — only SDK keys are eligible for auto-fix (system keys are auto-excluded).
- **💬 Opt-in Commented-Secret Scan**: For config files that toggle test/prod values via comments, `blind`/`mask` ask "Also scan secrets in commented-out code?". Findings are reported in a separate section but auto-fix is intentionally skipped — manual deletion is recommended. (Available directly via `scan --scan-comments`.)
- **🚫 Interactive Directory Exclusion**: `blind`/`mask` prompt for additional folders to exclude (third-party SDKs, build artifacts, etc.) as a comma-separated glob list, applied immediately.
- **🌐 Multilingual Output (한국어 / English)**: On first run, an interactive language picker appears (`1. English` / `2. 한국어`). All subsequent output is rendered in the chosen language. Switch later with `blinder set_language ko|en`.

---

## 📦 Installation

### Option 1 — Global install (recommended)

```bash
npm install -g github:YellowC-137/Blinder
blinder --version
```

### Option 2 — Clone source + npm link (for development / contributing)

```bash
git clone https://github.com/YellowC-137/Blinder.git
cd Blinder
npm install
sudo npm link
```

### Requirements
- Node.js **18 or newer**
- macOS / Linux / Windows (PowerShell)
- For iOS Bridge: macOS + Xcode 14+ recommended

### 🌐 First Run — Language Selection

The first time you run any command (e.g., `blinder scan`) after installation, you'll see this prompt:

```text
👋 Welcome to Blinder / Blinder에 오신 것을 환영합니다
? Choose your language / 사용할 언어를 선택하세요
  ❯ 1. English
    2. 한국어
```

The choice is persisted to `~/.blinder/config.json`, and every subsequent command — descriptions, prompts, logs, error messages — renders in that language. In non-TTY environments (CI / pipes / `--yes`), Blinder automatically writes `en` so pipelines are never blocked.

Switch later:

```bash
blinder set_language ko    # switch to 한국어
blinder set_language en    # switch to English
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

**Interactive prompts** (in order):
1. **Scan comments?** — "Also scan secrets inside commented-out code?" Useful for config files that toggle test/prod values via comments. Default `No`.
2. **Commit confirmation** — "Have you committed your current changes and are you ready to proceed?" Safety gate.
3. **Additional excludes** — Comma-separated glob patterns for third-party SDK / vendor folders (`**/ExtLib/**, **/Temp/**`). Press Enter to skip.
4. **Choose how to proceed** — Auto-fix / Manual / Exit.

Flags:
- `-y, --yes`: Auto-answers all prompts. Suitable for CI/CD.
- `--dry-run`: Preview changes without modifying files.

> [!NOTE]
> **Commented-secret handling**: When opted in, commented findings are **never auto-fixed** (the line is dead code; rewriting to env lookups is meaningless). They appear in a separate `💬 Commented-out Secrets` section and are flagged for manual deletion.

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

**Interactive prompts** (in order):
1. **Subdirectory to mask** — Press Enter for the entire project, or pass a path like `src/features/login`.
2. **Additional excludes** — Comma-separated glob patterns (`**/ExtLib/**, **/allatori/**`). Excluded paths are skipped from both the copy AND the secret scan.
3. **Scan comments?** — Same prompt as `blind`.

Options:
- `-o, --output <dir>`: Output folder name. Default: `maskedProject_<projectName>/`.
- `-y, --yes`: Auto-answers everything (entire project / no excludes / comments not scanned).

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
- `--include-examples`: Include matches inside `test/example` folders.
- `--scan-comments`: Also scan secrets inside commented-out code. Reported in a separate `💬 Commented-out Secrets` section (auto-fix never applied).

#### C-2. `blinder gitignore` — augment `.gitignore`
Adds detected platform-specific templates (.env, build/, *.jks, ...) + Blinder-generated files to `.gitignore`.

#### C-3. `blinder add_platform` — new-platform scaffolder
Interactively generates one plugin file + auto-registers it in `index.js`. See [Adding a New Platform Plugin](#-adding-a-new-platform-plugin-plugin-architecture).

#### C-4. `blinder set_language <ko|en>` — switch CLI language
Switches CLI output between 한국어 and English. Persisted to `~/.blinder/config.json` and applied immediately. The first-run prompt usually handles the initial choice — this command is for changing your mind later.

#### C-5. `blinder help` — help
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
> **Heuristic auto-protection**: Even without configuration, files containing `Copyright`, `SDK`, or `Third-party` near the top are recognized as external libraries and skipped automatically.

---

## 🔧 Platform-Specific Auto-fix Examples (`blind` workflow)

| Platform | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter (Dart)** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android (Kotlin/Java)** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS (Swift)** | `"glpat...789"` | `(Bundle.main.object(forInfoDictionaryKey: "GITLAB_TOKEN") as? String ?? "")` |
| **iOS (Obj-C)** | `NSString *const API_URL = @"..."` | `#define API_URL [[NSBundle mainBundle] objectForInfoDictionaryKey:@"API_URL"]` |
| **Node.js** | `const KEY = "sk-..."` | `const KEY = process.env.OPENAI_API_KEY` |
| **React (CRA)** | `apiKey: "AIza..."` | `apiKey: process.env.REACT_APP_FIREBASE_API_KEY` |
| **React (Vite)** | `apiKey: "AIza..."` | `apiKey: import.meta.env.VITE_FIREBASE_API_KEY` |
| **React (Next.js, client)** | `apiKey: "AIza..."` | `apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY` |
| **Spring Boot (Java)** | `@Value("plain-secret")` | `@Value("${SECRET_NAME}")` |
| **Spring Boot (.yml)** | `password: "abc123"` | `password: ${DB_PASSWORD}` |
| **Ruby** | `ENDPOINT = "https://hooks.slack.com/..."` | `ENDPOINT = ENV["SLACK_WEBHOOK_URL"]` |

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

#### ⚛️ React (CRA / Vite / Next.js)
- Build tool auto-detected (`react-scripts` / `vite` / `next` deps).
- **Next.js**: Client/server is determined from file path (`pages/api/*` is server, `pages/*` is client) plus the `'use client'` directive. Client files automatically get the `NEXT_PUBLIC_` prefix.

#### ☕ Spring Boot
- `@Value("plain-secret")` → `@Value("${VAR}")` auto-migration.
- If the literal is already a `${prop:default}` placeholder, the user-declared fallback is preserved — auto-conversion is intentionally skipped.
- `.properties` / `.yml` / `.xml` are rewritten to the `${VAR}` form.

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

## ❓ FAQ

<details>
<summary><strong>Q. What about secrets that are already pushed to git?</strong></summary>

Blinder operates on the **current working tree**. Clean older commits with [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) or `git filter-repo`, and **always rotate the secret immediately** afterward.
</details>

<details>
<summary><strong>Q. I ran <code>blind</code> and the build broke.</strong></summary>

Almost always caused by skipping `bridge`. Run `blinder bridge` to wire up BuildConfig / Podfile post_install / dart-define. If it's still broken, `blinder rollback` reverts everything instantly.
</details>

<details>
<summary><strong>Q. Can I just build the masked copy (<code>maskedProject_*</code>)?</strong></summary>

❌ Never. Every secret is replaced with `__BLINDER_VAR__`, which causes compile errors or NPEs. Don't ask the AI to "build and verify" either. The copy is **read-only**.
</details>

<details>
<summary><strong>Q. Does Blinder scan vendor SDK folders (myCustomSDK, etc.)?</strong></summary>

The default heuristic (detection of `Copyright`, `SDK`, `Third-party` markers) tries to skip them, but it's not 100%. Add them explicitly to `.blinderSettings` `ignorePaths`.
</details>

<details>
<summary><strong>Q. How do I integrate this into CI/CD?</strong></summary>

`blinder scan --ci` exits non-zero on detection. Add it as a step in GitHub Actions / GitLab CI / Jenkins to gate PR merges.

```yaml
# .github/workflows/blinder.yml
- name: Scan secrets
  run: npx -y github:YellowC-137/Blinder scan --ci
```
</details>

<details>
<summary><strong>Q. How do I add custom secret patterns?</strong></summary>

Add a regex + severity entry under `customPatterns` in `.blinderSettings`. See the [Project Configuration](#%EF%B8%8F-project-configuration-blindersettings) section for an example.
</details>

<details>
<summary><strong>Q. Are commented-out secrets (e.g., test/prod toggles) detected?</strong></summary>

By default, **no** — commented lines are skipped to limit false positives. You can opt in via the `blind`/`mask` interactive prompt ("Also scan secrets inside commented-out code?") or directly via `blinder scan --scan-comments`.

When opted in, commented findings appear in a separate `💬 Commented-out Secrets` section but **auto-fix is intentionally skipped** — the line is dead code, so rewriting it to an env lookup adds nothing. Blinder instead recommends deleting the line manually.

⚠️ Note: a prod URL/key parked in a comment is still a leaked secret if it lands in git. If found, rotate the secret and delete the line.
</details>

<details>
<summary><strong>Q. How is the Next.js <code>NEXT_PUBLIC_</code> prefix decided?</strong></summary>

If the file starts with the `'use client'` directive, or it lives under `pages/` (excluding `pages/api/*`), Blinder treats it as client-side and adds the `NEXT_PUBLIC_` prefix. Everything else (App Router default RSC, `lib/`, `utils/`) is treated as server-side and uses bare `process.env.X`.
</details>

<details>
<summary><strong>Q. How do I change the CLI output language?</strong></summary>

The first command after install pops a `1. English` / `2. 한국어` picker. After that, switch any time with `blinder set_language ko` or `blinder set_language en`. Config lives at `~/.blinder/config.json`.

In non-TTY environments (CI / pipes), Blinder writes `en` automatically so pipelines aren't blocked by the first-run prompt.
</details>

<details>
<summary><strong>Q. Should I commit <code>.blinder_protect.json</code> / <code>.blinder_map.json</code>?</strong></summary>

❌ Both are auto-added to `.gitignore`. They are local-only metadata. **Never delete them locally** either — without them, exact-position restore/merge is not possible.
</details>

---

## 🔌 Adding a New Platform Plugin (Plugin Architecture)

Add support for new languages and frameworks without touching the core engine. Full guide + troubleshooting: [CONTRIBUTING.md](./CONTRIBUTING.md).

### 🗺️ What a Plugin Does

Each language/framework is **one plugin = one file**. The core engine knows zero language rules — the plugin tells it:

| Responsibility | Method |
|---|---|
| Is this project mine? | `detect(repoPath)` |
| Which extensions to scan? | `commonExtensions` |
| What to replace a hardcoded secret with? | `getAutoFixReplacement(match, envVarName, ext)` |
| (optional) How to wire `.env` into the build system? | `setupBridge(repoPath)` / `teardownBridge(repoPath)` |
| (optional) Cases simple substitution can't handle? | `applyAdvancedFix(context)` |

Write the plugin file → register in `src/platforms/index.js` → done.

### 🚀 Fastest Path: CLI Scaffolder

```bash
blinder add_platform
# or
npm run add-platform
```

Interactive — 5 inputs:

| Prompt | Meaning | Example |
|---|---|---|
| Platform ID | Internal identifier + filename | `django` |
| Display name | What users see | `Django` |
| Category | Backend / Frontend / Mobile / Custom | `Backend` |
| Scan extensions | Comma-separated | `.py,.html` |
| Detection file | `detect()` marker | `manage.py` |

Automated steps:
1. Generates `src/platforms/<category>/<id>.js` — env-accessor auto-picked by **first extension**:

   | First extension | Auto-generated accessor |
   |---|---|
   | `.py` | `os.environ.get("VAR")` |
   | `.rb` | `ENV["VAR"]` |
   | `.java` / `.kt` | `System.getenv("VAR")` |
   | `.go` | `os.Getenv("VAR")` |
   | `.rs` | `std::env::var("VAR").unwrap_or_default()` |
   | `.php` | `getenv('VAR')` |
   | other | `process.env.VAR` |

2. Auto-adds import + array entry to `src/platforms/index.js`.

After generation, follow the printed "🚀 Next steps" to refine `detect()` / `getAutoFixReplacement()` and verify with `blinder scan --dry-run`.

### ✍️ Prefer Writing It By Hand: Minimal Template

Only `detect`, `commonExtensions`, and `getAutoFixReplacement` are strictly required.

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
  common, ios, android, flutter, ruby,
  python
];
```

> [!TIP]
> **`definePlatform()` validates required fields (`id`, `name`, `detect`, `commonExtensions`) at load time** and throws on missing values. Optional hooks (`preFix`/`postFix`/`setupBridge`, etc.) get safe defaults.

### 🎁 Common Optional Additions

```javascript
definePlatform({
  // ...required fields elided

  // Always-flagged sensitive files
  sensitiveFiles: [
    { glob: '**/local_settings.py', severity: 'CRITICAL', reason: 'Django local secrets' }
  ],

  // Excludes (vendor / build outputs)
  ignorePaths: ['**/migrations/**', '**/venv/**'],

  // Section appended by `blinder gitignore`
  getGitignoreTemplate: () => `\n# Django\n*.pyc\n__pycache__/\n.env\n`,

  // Different accessor per extension
  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.html') return `{{ ${envVarName} }}`;
    return `os.environ.get("${envVarName}")`;
  }
});
```

### 🔐 If Your Platform Uses Structured Config Files

For Info.plist / AndroidManifest meta-data / .properties / .xcconfig and similar key/value config files, do **not** match them as raw strings. The scanner already routes them through dedicated parsers (`src/detectors/parsers/*`) and gates auto-fix via `src/protectors/keyClassifier.js`.

Auto-fix policy is **default-deny**:
- ✅ Only whitelisted keys are eligible (`*_API_KEY`, SDK keys, etc.)
- ❌ System keys (`CFBundle*`, `androidx.*`, `org.gradle.*`) are never rewritten

To extend coverage, add classifier rules in `keyClassifier.js`.

### ✅ Verify

```bash
# Unit + parser + classifier tests
npm test

# Make sure the registry parses
node -e "import('./src/platforms/index.js').then(m => console.log(m.platforms.map(p => p.id)))"

# Platform detection + auto-fix preview
blinder scan --path /your/project --dry-run
blinder blind --path /your/project --dry-run -y

# (optional) Real sample project build regression
npm run test:regression
```

### 🐛 Common Pitfalls

| Symptom | Fix |
|---|---|
| `Platform plugin must have an "id" property.` | Fill required fields (`id`/`name`/`detect`/`commonExtensions`) |
| File created but plugin not active | Missing import + array entry in `index.js` |
| Not in `Detected platforms` output | `detect()` returned false. Marker file is checked at the **repo root** |
| Comments get rewritten | Override `commentRegex` |
| Build breaks after `blind` | Implement `setupBridge()` (BuildConfig / dart-define / etc.) |
| `rollback` leaves bridge code | Always pair `setupBridge()` with `teardownBridge()` |

Full IPlatform interface / lifecycle / bridge implementation examples: [CONTRIBUTING.md](./CONTRIBUTING.md).

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
> **Vendor library build impact**: In-house security libraries may have constraints (key-length checks, etc.). Recommended to exclude them via `.blinderSettings` `ignorePaths` first.

> [!CAUTION]
> **Rotate any secret that has been exposed**: Blinder is not a post-incident cleanup tool. Any key that has touched git history, backups, or external copies must be rotated to a fresh value immediately.

---

## 🤝 Contributing · License · Acknowledgments

### Contributing
Plugins for new platforms, bug reports, doc improvements, and pattern additions are all welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md).

- 🐛 **Bug reports**: [GitHub Issues](https://github.com/YellowC-137/Blinder/issues)
- 💡 **Feature requests**: [GitHub Discussions](https://github.com/YellowC-137/Blinder/discussions)
- 🔌 **New-platform PRs**: `blinder add_platform` → refine the generated file → PR

### License

[ISC License](./LICENSE) © Blinder Contributors.

### Acknowledgments

- AST engine: [`web-tree-sitter`](https://github.com/tree-sitter/tree-sitter) + [`tree-sitter-wasms`](https://github.com/Menci/tree-sitter-wasms)
- CLI / UX: [`commander`](https://github.com/tj/commander.js), [`inquirer`](https://github.com/SBoudrias/Inquirer.js), [`chalk`](https://github.com/chalk/chalk), [`ora`](https://github.com/sindresorhus/ora)

<div align="center">

**Lose the secrets, keep the code.**
Thanks to everyone who uses and contributes to Blinder. ⭐ Star us if you find it useful.

</div>
