# Blinder 🛡️

[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_en.md)

**Blinder** is an automated security tool for the AI era designed to prevent sensitive information in your source code from leaking when using AI agents (Cursor, ChatGPT, Claude, etc.).

It detects hardcoded API keys in mobile development environments (iOS, Android, Flutter), safely isolates them into `.env` files, and creates a masked copy of your project with masked secrets before handing it over to AI agents.

---

## ✨ Key Features

- **🛡️ Auto-Environment Variable Conversion (Auto-fix)**: Moves detected secrets to `.env` and automatically replaces them with platform-specific environment variable reference code (Dart, Kotlin, Swift, Obj-C, etc.). (Now supports intelligent macro migration for Objective-C compile-time constants).
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
- **Secure Workflow**: Provides an interactive phase to review targeted files and prompt for **additional folder exclusions (e.g., ExtLib)** before modification.
- `-y, --yes`: Automatically answers 'yes' to all interactive prompts, suitable for CI/CD pipelines.

#### 2. `blinder bridge` (Native Integration)
Automates build settings so that the contents of the generated `.env` file are automatically recognized by Android (`BuildConfig`), iOS (`Info.plist`), and Flutter (`--dart-define`) systems.
- **Android**: Automatically injects an environment variable loading script into `build.gradle`.
- **iOS**: Generates a guide script (`blinder-ios-setup.sh`) that can be injected into the Xcode build phase.
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
Automatically appends platform-specific vulnerable files and Blinder-generated files to `.gitignore` according to the current project platform (iOS, Android, Flutter).

#### 8. `blinder help` (Help)
Displays help information for all available commands and detailed option descriptions in the terminal.

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

> [!CAUTION]
> **Build Configuration Modification**: Blinder's `blind` (Auto-fix) and `bridge` features directly modify core build files (e.g., `build.gradle`, `.pbxproj`, `Info.plist`). Always ensure all changes are **committed to Git** before execution to maintain a recoverable state.

> [!IMPORTANT]
> **Backup before Auto-fix**: Blinder directly modifies actual source code files. It is highly recommended to run it on a clean working tree (after a `git commit`) so you can easily review the changes.

> [!WARNING]
> **Managing `.env` files**: While Blinder automatically adds `.env` to `.gitignore`, always make it a habit to manually verify that the `.env` file is untracked by Git before committing.
