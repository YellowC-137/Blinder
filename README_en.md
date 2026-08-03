<div align="center">

# Blinder 🛡️

**Hardcoded secrets out, into `.env` — without breaking the build.**

[🇰🇷 한국어](./README.md) · [🇺🇸 English](./README_en.md) · [Contributing](./CONTRIBUTING.md)

[![Node.js](https://img.shields.io/badge/node-%E2%89%A520.12-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](./tsconfig.json)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Flutter%20%7C%20Node%20%7C%20Spring%20%7C%20React%20%7C%20Ruby-orange.svg)](#-supported-platforms--languages)
[![Plugin Architecture](https://img.shields.io/badge/architecture-plugin--based-purple.svg)](./docs/architecture.md)
[![CI Ready](https://img.shields.io/badge/CI-ready-success.svg)](./docs/commands.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)


</div>

> **Blinder** is a **secret-refactoring tool**: it extracts hardcoded API keys and credentials into `.env` and auto-wires the platform build system — `BuildConfig`, `Info.plist`, `dart-define` — so the build keeps working. Scanners only *find* secrets; Blinder automates the fixing that comes after.
>
> From mobile (iOS · Android · Flutter) to backend (Spring Boot · Node.js · Java · Ruby) and frontend (React/CRA/Vite/Next.js) — a **plugin architecture** covers every platform. A `mask` workflow for safely sharing code with AI agents (Cursor, ChatGPT, Claude) is included too.

---

## 🚀 Quick Start

```bash
# 1) Install globally
npm install -g github:YellowC-137/Blinder

# 2) Move into your project
cd /path/to/your/project

# 3) Extract secrets to .env + auto-wire the build system (build keeps working)
blinder blind && blinder bridge

# 4) Or for AI sharing: create a masked read-only copy (original untouched)
blinder mask

# 5) Undo
blinder rollback    # revert blind
blinder restore     # merge AI edits back to original
```

> [!IMPORTANT]
> **Always `git commit` before any command.** Blinder modifies build-critical files (`build.gradle`, `Podfile`, `Info.plist`, `.pbxproj`).

---

![Blinder CLI Demo](./Kapture.gif)

---

## ✨ How it Works

**`blinder blind`** — extract secrets from production code into `.env`:

```diff
- String apiKey = "sk_live_abc123..."      # Before
+ String apiKey = BuildConfig.STRIPE_KEY   # After (still builds)
```

**`blinder bridge`** — auto-wire the extracted `.env` into each platform's build system. Idempotently injects Android `BuildConfig`, an iOS Run Script + `Info.plist` wiring, and Flutter `--dart-define-from-file`, so the build keeps working after extraction. Automating this "fixing after finding" is Blinder's core.

**`blinder mask`** — (secondary workflow) create a read-only copy safe to share with AI:

```diff
- apiKey: "AIzaSy9xK2mP3rT..."              # original (leak risk)
+ apiKey: "__BLINDER_FIREBASE_API_KEY__"    # masked (safe)
```

The secret ↔ token mapping is stored **outside** the copy (`<project root>/.blinder_maps/`), so sharing the entire masked directory with an AI leaks nothing.

> [!IMPORTANT]
> You cant Build masked project. It is only for AI Agent read-only project.


<details>
<summary><strong>🤔 Why Blinder?</strong></summary>

| Risk Scenario | How Blinder Solves It |
|---|---|
| 🪣 **Sharing folder "minus `.env`"** — hardcoded keys in source still ship | `blind` extracts keys into `.env` + auto-rewrites with env accessors |
| 🤖 **Asking AI to "refactor"** — partial keys end up in answers / training data | `mask` replaces all secrets with `__BLINDER_*__` tokens in a **read-only copy** |
| 🧨 **Worried about breaking the build** — moving keys to `.env` needs BuildConfig / Info.plist / dart-define wiring | `bridge` idempotently injects per-platform build-system wiring |
| 🔁 **Merging AI edits back** — flipping tokens back to real secrets is error-prone | `restore` auto-restores from the `.blinder_maps/` mapping |
| 📦 **Sharing the copy wholesale leaks the map** — the mapping file holds every original secret | The map lives **outside** the copy (`.blinder_maps/`) — the copy contains zero secrets |
| 🚨 **CI/CD gate needed** | `scan --ci` offers a simple gate (see "Relation to scanners" below for serious gating) |

</details>

---

## 🧭 Relation to secret scanners

Dedicated scanners like [Gitleaks](https://github.com/gitleaks/gitleaks) (160+ patterns) and [TruffleHog](https://trufflesecurity.com/trufflehog) (800+ detectors, live key verification) are optimized for **finding** secrets — leave that job to them. Blinder's job starts **after**: extracting the found secrets into `.env` and auto-fixing the platform wiring so the build doesn't break. The built-in `blinder scan` is a lightweight scanner; for CI gating we recommend a dedicated scanner.

---

## 🧩 Supported Platforms / Languages

| Platform | Category | Detection file | Scan extensions | Status |
|---|---|---|---|:---:|
| **iOS** (Swift / Obj-C) | mobile | `*.xcodeproj`, `Podfile` | `.swift`, `.m`, `.h`, `.plist`, `.xcconfig` | ✅ Stable |
| **Android** (Kotlin / Java) | mobile | `build.gradle`, `AndroidManifest.xml` | `.kt`, `.java`, `.xml`, `.gradle`, `.properties` | ✅ Stable |
| **Flutter** (Dart) | mobile | `pubspec.yaml` | `.dart`, `.yaml` | ✅ Stable |
| **Node.js** | backend | `package.json` (no frontend deps) | `.js`, `.mjs`, `.cjs`, `.ts` | ✅ Stable |
| **Java** | backend | `pom.xml` or `src/main/java/` | `.java`, `.properties`, `.xml` | ✅ Stable |
| **Spring Boot** | backend | `pom.xml`(spring-boot-starter) | `.java`, `.kt`, `.properties`, `.yml`, `.xml` | ✅ Stable |
| **React** (CRA / Vite / Next.js) | frontend | `package.json` (`react` deps) | `.js`, `.jsx`, `.ts`, `.tsx` | ✅ Stable |
| **Ruby** | backend | `Gemfile` | `.rb` | ✅ Stable |
| **Common** | core | (every project) | `.env`, `.json` | ✅ Stable |

> Add a new platform → [Plugin Architecture Guide](./docs/architecture.md) or [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 📚 Documentation

| Doc | Contents |
|---|---|
| [📋 commands.md](./docs/commands.md) | Full command reference (`blind`, `mask`, `scan`, `bridge`, `rollback`, `restore`) |
| [⚙️ configuration.md](./docs/configuration.md) | `.blinderSettings` options, custom patterns, metadata files |
| [🔧 platforms.md](./docs/platforms.md) | Per-platform auto-fix examples, caveats, structured-file policy |
| [🔌 architecture.md](./docs/architecture.md) | Plugin architecture, IPlatform interface, adding new platforms |

<details>
<summary><strong>❓ FAQ</strong></summary>

**Q. What about secrets already pushed to git?**
Blinder works on the current working tree only. Clean older commits with [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) and **rotate the secret immediately**.

**Q. I ran `blind` and the build broke.**
Almost always caused by skipping `bridge`. Run `blinder bridge`. Still broken? `blinder rollback` reverts everything instantly.

**Q. Can I build the masked copy (`maskedProject_*`)?**
❌ Never. Every secret is replaced with a `__BLINDER_*__` token — compile errors guaranteed. The copy is **read-only**.

**Q. How do I integrate with CI/CD?**
For serious gating we recommend Gitleaks/TruffleHog; for a quick start:
```yaml
- name: Scan secrets
  run: npx -y github:YellowC-137/Blinder scan --ci
```

**Q. Should I commit `.blinder_protect.json` / `.blinder_maps/`?**
❌ Both are auto-added to `.gitignore`. Local-only. **Never delete them** until `restore`/`rollback` is done — without them, merging back is not possible.

**Q. Where is the secret mapping stored?**
`<project root>/.blinder_maps/<maskDirName>.json`. The masked copy itself contains no secrets at all, so sharing the whole copy directory is safe. (Legacy `.blinder_map.json` inside old copies is still recognized by `restore`.)

</details>

<details>
<summary><strong>⚠️ Common Precautions</strong></summary>

> [!IMPORTANT]
> **`git commit` before any Blinder command**: So you can review changes and revert quickly.

> [!WARNING]
> **Managing `.env` files**: Blinder auto-adds `.env` to `.gitignore`, but verify manually before final commit.

> [!CAUTION]
> **Rotate any exposed secret immediately**: Blinder is not a post-incident tool. Any key that touched git history, backups, or external copies must be replaced with a fresh key.

</details>

---

## 🤝 Contributing · License

Plugins for new platforms, bug reports, doc improvements, and pattern additions are all welcome.

- 🐛 **Bug reports**: [GitHub Issues](https://github.com/YellowC-137/Blinder/issues)
- 💡 **Feature requests**: [GitHub Discussions](https://github.com/YellowC-137/Blinder/discussions)
- 🔌 **New-platform PRs**: `blinder add_platform` → refine → PR → [CONTRIBUTING.md](./CONTRIBUTING.md)

[ISC License](./LICENSE) © Blinder Contributors.

<div align="center">

**Lose the secrets, keep the code.**
⭐ Star us if you find it useful.

</div>
