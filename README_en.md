# Blinder 🛡️

[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_en.md)

**Blinder** is an automated security tool for the AI era designed to prevent sensitive information in your source code from leaking when using AI agents (Cursor, ChatGPT, Claude, etc.).

From mobile (iOS, Android, Flutter) to backend (Spring Boot, Node.js, etc.), Blinder uses a **plugin architecture** to detect hardcoded API keys across all platforms, safely isolate them into `.env` files, and create a masked copy of your project before handing it over to AI agents.

---

## ✨ Key Features

- **🛡️ Auto-Environment Variable Conversion (Auto-fix)**: Moves detected secrets to `.env` and automatically replaces them with platform-specific environment variable reference code (Dart, Kotlin, Swift, Obj-C, Java, etc.). Easily extensible to new platforms via the plugin architecture.
- **🔌 Plugin-Based Extension**: Support new languages and frameworks simply by implementing the IPlatform interface. Add a single file to `src/platforms/` without modifying the core engine, and it integrates into the entire pipeline.
- **🔍 AI-Optimized Scanning**: Minimizes false positives by ignoring secrets within comments and automatically filtering out non-secret numeric data (error codes, ports, etc.) and test code (`*Tests*`, `test/`).
- **🛡️ Rock-Solid Default Ignores**: Automatically blocks common framework dependency folders (`Pods`, `build`, `.gradle`, `.dart_tool`, etc.) to prevent accidental modification of third-party libraries on the first run.
- **📜 Multi-line Secret Detection**: Flawlessly detects and processes multi-line sensitive data such as PEM Private Keys and certificates.
- **⚙️ Enterprise-Grade Optimization**: Comprehensive detection for global services (Google, AWS, Stripe), regional SDKs (Kakao, Naver), IPv4 infrastructure addresses, and DB connection strings.
- **📊 Automated Reports & CI Support**: Saves scan history to `blinder_reports/` on every run, and provides `--ci` or `-y` (yes) modes to preemptively block security incidents in your pipeline.

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
# Install directly via npm
npm install -g github:YellowC-137/Blinder
```

### Essential Commands

#### 1. `blinder blind` (Initial Setup)
Detects secrets within the project and migrates them to `.env`, laying the groundwork for project security. It performs `scan` + `protect` + `gitignore` in a single workflow.
- **Secure Workflow**: Provides an interactive phase to review targeted files and prompt for **additional folder exclusions (e.g., User Custom Library)** before modification.
- `-y, --yes`: Automatically answers 'yes' to all interactive prompts, suitable for CI/CD pipelines.

#### 2. `blinder bridge` (Build System Integration)
Automates build settings so that the contents of the generated `.env` file are automatically recognized by each platform's build system (Android `BuildConfig`, iOS `Info.plist`, Flutter `--dart-define`, etc.). Each plugin's `setupBridge()` is invoked.
- **Android**: Automatically injects an environment variable loading script into `build.gradle`.
- **iOS (Native & Flutter)**: Automatically appends an environment variable injection hook (`post_install`) to the `Podfile`.
  - Running `pod install` will automatically configure the 'Blinder Env Loader' in the Xcode Build Phases.
  - **🚨 If no Podfile is found (Manual Setup Required)**: You must manually register the script in Xcode's `Build Phases` following the `blinder-ios-setup.sh` guide. It is mandatory to **uncheck 'Based on dependency analysis'** and set **'User Script Sandboxing' to NO**.
- **Flutter**: Automatically adds environment variable flags to IDE (VS Code, IntelliJ) execution settings.

#### 3. `blinder mask` (Before Sending to AI)
Creates a **masked copy of the project** that replaces secrets with `__BLINDER_VAR__` tags, granting AI agents (like Cursor) full project context without risking secret leaks.

#### 4. `blinder restore` (After AI Modifications)
Safely brings **all code modifications and new files** created by the AI agent in the masked folder back into the original project. Masked secrets are automatically restored to their actual values.

#### 5. `blinder scan` (Manual Scan)
Manually detects secrets in the project and generates a detailed report.
- `--ci`: Fails the build if secrets are found to prevent security incidents in the CI pipeline.
- `-o <file>`: Exports the scan results to a specific JSON file.

#### 6. `blinder rollback` (Undo Protection)
Undoes the source code migration (accessor replacement) applied by `blind` or `protect`, restoring it to the original hardcoded state. Also allows for bulk deletion of generated security files.

#### 7. `blinder gitignore` (Auto-setup .gitignore)
Automatically appends platform-specific vulnerable files and Blinder-generated files to `.gitignore` based on detected platforms. Each plugin's gitignore template is automatically applied.

#### 8. `blinder help` (Help)
Displays help information for all available commands and detailed option descriptions in the terminal.

---

## 🛠️ Project Configuration (`.blinderSettings`)

You can customize Blinder's behavior by creating a `.blinderSettings` file (JSON format) in your project root. This is particularly useful for excluding third-party SDKs or proprietary security libraries from the scanning and migration process.

### Configuration Options
- `ignorePaths`: Array of glob patterns for files or folders to skip during scanning and Auto-fix.
- `customPatterns`: Add project-specific secret patterns (Regex support).
- `maskOutput`: Default folder name for the result of the `blinder mask` command.

### Example (`.blinderSettings`)
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
> **Intelligent Heuristic Protection**: Even without a configuration file, Blinder automatically detects and skips files containing `Copyright`, `SDK`, or `Third-party` keywords in the first 10 lines to prevent corruption of external libraries.

---

## 🔧 Platform-Specific Auto-fix Examples

| Platform | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS (Swift)** | `"glpat...789"` | `ProcessInfo.processInfo.environment["GITLAB_TOKEN"] ?? ""` |
| **iOS (Obj-C)** | `NSString *const API_URL = @"..."` | `#define API_URL [[NSBundle mainBundle] ...]` |

### ⚠️ Platform-Specific Auto-fix Caveats

When applying `blinder protect` (Auto-fix), there are specific considerations for each platform due to language constraints and build systems. (`blinder mask` works 100% across all languages since it only replaces string values.)

#### 🍎 iOS (Objective-C)
* **Global Constant Migration**: Global constants like `NSString *const API_KEY = @"..."` cannot be initialized with runtime functions due to C-level compile-time constraints.
* **Blinder Handling**: Blinder detects these declarations and automatically migrates them into **Macros (`#define API_KEY [[NSBundle mainBundle] ...]`)** which evaluate at runtime.
* **Note**: Primitive numeric constants (e.g., `int`, `double`) are currently excluded from Auto-fix to prevent build breakage. It is recommended to handle them manually or convert them into string constants if needed.

#### 🍏 iOS (Swift)
* Swift supports runtime evaluation for global or static variables. Injecting `Bundle.main.infoDictionary?...` works without syntax errors.
* **Note**: For the injected variables to have actual values at runtime, you must manually sync your `.xcconfig` and `Info.plist` to read from the `.env` file.

#### 🤖 Android (Kotlin / Java)
* **BuildConfig Integration**: Auto-fix replaces hardcoded strings with `BuildConfig.VARIABLE_NAME`.
* **Note**: To ensure the project compiles, your `build.gradle` (or `build.gradle.kts`) must be configured to read the `.env` file and generate BuildConfig fields. Failing to do so will result in `Unresolved reference: BuildConfig`.
* For `.xml` files (e.g., `AndroidManifest.xml`), secrets are replaced with `@string/VARIABLE_NAME`, requiring corresponding entries in `strings.xml`.

#### 🦋 Flutter (Dart)
* **dart-define Constraint**: Dart code is replaced with `String.fromEnvironment('VAR')`.
* **Note**: You must explicitly pass the environment variables during build or run using the `--dart-define-from-file=.env` flag (e.g., `flutter run --dart-define-from-file=.env`). Otherwise, all replaced values will return as empty strings (`""`).

---

## 🔌 Adding a New Platform Plugin

Blinder uses a **plugin architecture** that lets you add support for new languages and frameworks without touching the core engine.

### Quick Start: CLI Scaffolding

```bash
blinder add_platform
```

Answer the interactive prompts, and the plugin file generation + registry registration will be completed **automatically**. You can choose a category (Backend, Frontend, Mobile) or define your own via the **Custom** option. For more details, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Manual: Minimal Template (This is all you need!)

Adding a new platform requires just **a few lines** of code.

```javascript
// Example: src/platforms/backend/python.js
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

Register in `src/platforms/index.js` and you're done:

```javascript
import python from './backend/python.js';   // ← Add

export const platforms = [
  common, ios, android, flutter,
  python   // ← Add
];
```

That's it! Blinder's scanning, Auto-fix, and .gitignore generation will now protect Python code! 🎉

> [!TIP]
> The `definePlatform()` helper automatically fills in defaults for `sensitiveFiles`, `ignorePaths`, `commentRegex`, etc.

### Verify

```bash
blinder scan --path /your/python-project --dry-run
# → Verify "Detected platforms: Common Environment, Python" in output

blinder blind --path /your/python-project --dry-run -y
# → Verify os.environ.get("VAR_NAME") replacement
```

<details>
<summary><strong>📖 Advanced Plugin API (Bridge, Advanced Fix, Lifecycle Hooks)</strong></summary>

#### Complete IPlatform Interface Specification

| Property / Method | Type | Required | Description |
|:---|:---|:---:|:---|
| `id` | `string` | ✅ | Unique identifier (lowercase, alphanumeric) |
| `name` | `string` | ✅ | Human-readable display name |
| `category` | `string` | ✅ | Category (`core`, `mobile`, `backend`, `web`) |
| `detect(repoPath)` | `async → bool` | ✅ | Determines if this platform applies |
| `commonExtensions` | `string[]` | ✅ | File extensions to scan |
| `sensitiveFiles` | `object[]` | | Sensitive file definitions |
| `commentRegex` | `RegExp` | | Regex to identify comment lines |
| `ignorePaths` | `string[]` | | Glob patterns to exclude from scan |
| `getGitignoreTemplate()` | `→ string` | | Content for .gitignore section |
| `getAutoFixReplacement(...)` | `→ string` | | Environment variable accessor code |
| `applyAdvancedFix(context)` | `→ object` | | Complex source code transformation (Stage 1) |
| `preFix(context)` | `async` | | Pre-modification hook |
| `postFix(context)` | `async` | | Post-modification hook |
| `setupBridge(repoPath)` | `async` | | Build system .env integration |
| `teardownBridge(repoPath)` | `async` | | Build system .env teardown |
| `testCases` | `object[]` | | Validation test cases |

#### Lifecycle Execution Order

```text
┌─────────────────────────────────────────────────────┐
│ protect.js: applyAutoFixes()                        │
│  for each file:                                     │
│    1. preFix()          ← Prepare before modifying  │
│    2. for each secret:                              │
│       a. applyAdvancedFix()  ← Stage 1 (Advanced)  │
│       b. getAutoFixReplacement() ← Stage 2 (Basic) │
│    3. postFix()         ← Cleanup after modifying   │
└─────────────────────────────────────────────────────┘
```

#### Advanced Example (Spring Boot)

```javascript
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
    { glob: '**/application-secret.yml', severity: 'CRITICAL', reason: 'Production DB/API keys' }
  ],
  ignorePaths: ['**/target/**', '**/.mvn/**'],
  getGitignoreTemplate: () => `\ntarget/\n*.jar\napplication-secret.yml\n`,
  getAutoFixReplacement: (match, envVarName, ext) => {
    if (ext === '.java') return `System.getenv("${envVarName}")`;
    if (ext === '.properties' || ext === '.yml') return `\${${envVarName}}`;
    return `process.env.${envVarName}`;
  }
});
```

</details>
---

## Precautions

> [!CAUTION]
> **Build Configuration Modification**: Blinder's `blind` (Auto-fix) and `bridge` features directly modify core build files (e.g., `build.gradle`, `.pbxproj`, `Info.plist`). Always ensure all changes are **committed to Git** before execution to maintain a recoverable state.

> [!IMPORTANT]
> **Backup before Auto-fix**: Blinder directly modifies actual source code files. It is highly recommended to run it on a clean working tree (after a `git commit`) so you can easily review the changes.

> [!WARNING]
> **Managing `.env` files**: While Blinder automatically adds `.env` to `.gitignore`, always make it a habit to manually verify that the `.env` file is untracked by Git before committing.
