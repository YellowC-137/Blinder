<div align="center">

# Blinder 🛡️

**Keep your code. Lose the secrets. Safe for AI.**

[🇰🇷 한국어](./README.md) · [🇺🇸 English](./README_en.md) · [Contributing](./CONTRIBUTING.md)

[![Node.js](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Flutter%20%7C%20Node%20%7C%20Spring%20%7C%20React%20%7C%20Ruby-orange.svg)](#-supported-platforms--languages)
[![Plugin Architecture](https://img.shields.io/badge/architecture-plugin--based-purple.svg)](./docs/architecture.md)
[![CI Ready](https://img.shields.io/badge/CI-ready-success.svg)](./docs/commands.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)


</div>

> **Blinder** prevents hardcoded API keys, credentials, and certificates from leaking when you hand source code to AI agents (Cursor, ChatGPT, Claude, …).
>
> From mobile (iOS · Android · Flutter) to backend (Spring Boot · Node.js · Java · Ruby) and frontend (React/CRA/Vite/Next.js) — a **plugin architecture** covers every platform.

---

## 🚀 Quick Start

```bash
# 1) Install globally
npm install -g github:YellowC-137/Blinder

# 2) Move into your project
cd /path/to/your/project

# 3) AI sharing: create a masked read-only copy (original untouched)
blinder mask

# 4) Or production: extract secrets to .env
blinder blind && blinder bridge

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


**`blinder mask`** — create a read-only copy safe to share with AI:

```diff
- apiKey: "AIzaSy9xK2mP3rT..."                  # original (leak risk)
+ apiKey: "__BLINDER_VAR__FIREBASE_API_KEY"       # masked (safe)
```

> [!IMPORTANT]
> You cant Build masked project. It is only for AI Agent read-only project.


<details>
<summary><strong>🤔 Why Blinder?</strong></summary>

| Risk Scenario | How Blinder Solves It |
|---|---|
| 🪣 **Sharing folder "minus `.env`"** — hardcoded keys in source still ship | `blind` extracts keys into `.env` + auto-rewrites with env accessors |
| 🤖 **Asking AI to "refactor"** — partial keys end up in answers / training data | `mask` replaces all secrets with `__BLINDER_VAR__` tokens in a **read-only copy** |
| 🧨 **Worried about breaking the build** — moving keys to `.env` needs BuildConfig / Info.plist / dart-define wiring | `bridge` idempotently injects per-platform build-system wiring |
| 🔁 **Merging AI edits back** — flipping tokens back to real secrets is error-prone | `restore` auto-restores from `.blinder_map.json` |
| 🚨 **CI/CD gate needed** | `scan --ci` returns non-zero exit code for pipeline gating |

</details>

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
❌ Never. Every secret is replaced with `__BLINDER_VAR__` — compile errors guaranteed. The copy is **read-only**.

**Q. How do I integrate with CI/CD?**
```yaml
- name: Scan secrets
  run: npx -y github:YellowC-137/Blinder scan --ci
```

**Q. Should I commit `.blinder_protect.json` / `.blinder_map.json`?**
❌ Both are auto-added to `.gitignore`. Local-only. **Never delete them** — without them, restore/merge is not possible.

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
