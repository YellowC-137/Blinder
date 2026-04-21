# Blinder 🛡️

[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_en.md)

**Blinder** is an automated security tool for the AI era designed to prevent sensitive information in your source code from leaking when using AI agents (Cursor, ChatGPT, Claude, etc.).

It detects hardcoded API keys in mobile development environments (iOS, Android, Flutter), safely isolates them into `.env` files, and creates a masked copy of your project with masked secrets before handing it over to AI agents.

---

## ✨ Key Features

- **🧹 Intelligent Masking (`mask`)**: Creates a safe copy of your project for AI agents in the `.blinder_masked/` folder, replacing all secrets with `__BLINDER_VAR__` tags. (1:1 restoration guaranteed)
- **🔍 AI-Optimized Scanning**: Minimizes false positives by ignoring secrets within comments and automatically filtering out test code (`*Tests*`, `test/`) and example data.
- **🛡️ Auto-Environment Variable Conversion (Auto-fix)**: Moves detected secrets to `.env` and automatically replaces them with platform-specific environment variable reference code (Dart, Kotlin, Swift, Obj-C, etc.).
- **📜 Multi-line Secret Detection**: Flawlessly detects and processes multi-line sensitive data such as PEM Private Keys and certificates.
- **⚙️ Enterprise-Grade & Regional Optimization**: Comprehensive detection for global service keys (Google, AWS, Stripe), regional SDK keys (Kakao, Naver), IPv4 infrastructure addresses, and DB connection strings.
- **📊 Automated Reports & CI Support**: Saves scan history to `blinder_reports/` on every run, and provides a `--ci` mode to preemptively block security incidents in your pipeline.

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
Detects secrets within the project and migrates them to `.env`, laying the groundwork for project security.

#### 2. `blinder rollback` (Undo Protection)
Undoes the "Auto-fix" secret protection measurements applied by `blind` or `scan`, restoring the source code parameters back to their original hardcoded state with the actual secrets. It also cleans up related generated files like `.env`, `.env.example`, and `blinder_reports/`.
```bash
blinder rollback
```

#### 3. `blinder mask` (Before Sending to AI)
Creates a **masked copy of the project** that replaces secrets with `<REDACTED>` tags, granting AI agents (like Cursor) full project context without risking secret leaks.
```bash
blinder mask
# Copies the entire project and replaces secrets with <REDACTED>
```

> [!WARNING]
> **Project Execution**: The masked project will not run normally. The copied project is intended solely for the AI agent to read and modify code. You can run the project normally after performing a restore following the AI's modifications.

#### 4. `blinder restore` (After AI Modifications)
Brings **all code modifications and new files** created by the AI agent in the `.blinder_masked/` folder back into the original project. The masked secrets are automatically restored to their actual values.
```bash
blinder restore
# Merges the AI's logic modifications and safely re-inserts the secrets.
```

#### 5. `blinder scan` (Manual Scan)
Manually scans the project for sensitive information and generates a report. Supports pipeline integration via the `--ci` flag.
```bash
blinder scan
blinder scan --ci # Automatically checks for secret leaks and aborts the build if found
blinder scan -o custom_report.json # Exports the scan results to a specific file
```

#### 6. `blinder gitignore` (Auto-setup .gitignore)
Detects your current project environment (Android, iOS, Flutter, etc.) and automatically appends platform-specific vulnerable files and Blinder-generated files (like `.env` and `.blinder_masked/`) to `.gitignore`. (This command is already included under the hood in `blind`.)

---

## 🛠️ Project Configuration (`.blinderrc`)

You can customize Blinder's behavior by creating a `.blinderrc` file in your project root.

```json
{
  "customPatterns": [
    { "name": "Internal API", "regex": "INTERNAL_[A-Z]{3}_KEY_[0-9a-f]{32}", "severity": "CRITICAL" }
  ],
  "ignorePaths": ["**/test/mocks/**"],
  "maskOutput": ".tmp_safe_code"
}
```

---

## 📱 Platform-Specific Auto-fix Examples

| Platform | Before (Hardcoded) | After (Blinder Auto-fix) |
| :--- | :--- | :--- |
| **Flutter** | `"AIza...123"` | `String.fromEnvironment('GOOGLE_API_KEY')` |
| **Android** | `"sk_live...456"` | `BuildConfig.STRIPE_LIVE_SECRET_KEY` |
| **iOS** | `"glpat...789"` | `ProcessInfo.processInfo.environment["GITLAB_TOKEN"] ?? ""` |

### ⚠️ Platform-Specific Auto-fix Caveats

When applying `blinder protect` (Auto-fix), there are specific considerations for each platform due to language constraints and build systems. (`blinder mask` works 100% across all languages since it only replaces string values.)

#### 🍎 iOS (Objective-C)
* **Global Constant Constraint**: Global constants like `NSString *const API_KEY = @"..."` cannot be initialized with runtime functions like `[[NSBundle mainBundle] ...]`. (Applying this results in the `Initializer element is not a compile-time constant` build error.)
* **Blinder Handling**: To prevent build breakage, Objective-C global constants are automatically marked as `isFixable: false` and skipped during Auto-fix.
* **Solution**: To enable Auto-fix for these constants, refactor them into **Macros (`#define API_KEY @"..."`)**, which are fully supported.

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

## Scan Report Example (Terminal Output)

```text
✔ Project root: /Users/dev/my-mobile-app
✔ Detected platforms: flutter, ios, android
- Scanning for secrets...
✔ Scan complete. Found 3 potential secrets.

Scan Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ [HIGH] lib/main.dart:10 - Google API Key
ℹ    Match: AIza...3456
⚠ [HIGH] ios/Runner/AppDelegate.swift:5 - GitLab Personal Access Token
ℹ    Match: glpa...ghij
⚠ [TEST KEY] test/mocks.dart:2 - Generic API Key
ℹ    Match: test...1234
```

---

## Precautions

> [!IMPORTANT]
> **Backup before Auto-fix**: Blinder directly modifies actual source code files. It is highly recommended to run it on a clean working tree (after a `git commit`) so you can easily review the changes.

> [!WARNING]
> **Managing `.env` files**: While Blinder automatically adds `.env` to `.gitignore`, always make it a habit to manually verify that the `.env` file is untracked by Git before committing.
