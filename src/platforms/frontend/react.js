import fs from 'fs';
import { definePlatform } from '../definePlatform.js';
import { readPackageJson, hasRuntimeDep, detectReactBuildTool } from '../../utils/packageJsonReader.js';

// Build-tool detection runs once per repo via preFix and is cached here so
// getAutoFixReplacement (which lacks repoPath) can read it. CLI runs target
// one repo per invocation, so a single module-level slot is sufficient.
let cachedBuildTool = null;

// Per-file client-side flag for Next.js. Set in preFix, read in
// getAutoFixReplacement. Next.js exposes env vars to the browser bundle only
// when prefixed with NEXT_PUBLIC_; server-side code uses bare process.env.X.
let currentFileClientSide = false;

/**
 * isNextjsClientSideFile
 *
 * Heuristic to decide whether a Next.js file ships to the browser bundle.
 *
 * - File starts with "use client" directive → client (overrides path)
 * - pages/api/** → server (API routes)
 * - pages/** (non-api) → client (Pages Router hydrates everything client-side)
 * - app/** without directive → server (App Router default = RSC)
 * - Anything else (lib/, utils/, components/) → server unless directive present
 */
function isNextjsClientSideFile(relPath, absPath) {
  const norm = relPath.replace(/\\/g, '/');

  if (absPath) {
    try {
      const head = fs.readFileSync(absPath, 'utf8').slice(0, 512);
      if (/^\s*['"]use client['"]/m.test(head)) return true;
    } catch { /* ignore */ }
  }

  if (/(^|\/)pages\/api\//.test(norm)) return false;
  if (/(^|\/)pages\//.test(norm)) return true;

  return false;
}

function pickAccessor(buildTool, envVarName, isClientSide = false) {
  switch (buildTool) {
    case 'cra':
      // CRA exposes only REACT_APP_* env vars to the bundle
      return `process.env.REACT_APP_${envVarName}`;
    case 'vite':
      return `import.meta.env.VITE_${envVarName}`;
    case 'nextjs':
      // Client-side files need NEXT_PUBLIC_ prefix to reach the browser
      // bundle. Server-side files (App Router default, pages/api/*, lib/*)
      // can use bare process.env.X.
      return isClientSide
        ? `process.env.NEXT_PUBLIC_${envVarName}`
        : `process.env.${envVarName}`;
    default:
      return `process.env.${envVarName}`;
  }
}

export default definePlatform({
  id: 'react',
  name: 'React',
  category: 'frontend',
  astLanguage: 'tsx',

  // Detect: package.json with `react` in production dependencies.
  // devDependencies/peerDependencies don't count — backend frameworks (e.g.,
  // Strapi) often list react as a peer dep for admin tooling but are not
  // React frontend projects.
  detect: async (repoPath) => {
    const pkg = readPackageJson(repoPath);
    if (!pkg) return false;
    return hasRuntimeDep(pkg, 'react');
  },

  commonExtensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'],

  sensitiveFiles: [
    { glob: '**/.env', severity: 'HIGH', reason: 'React 런타임 환경변수' },
    { glob: '**/.env.*', severity: 'HIGH', reason: '환경변수 변형 (.env.local 등 — 클라 빌드에 박힐 수 있음)' },
    { glob: '**/firebase-config.js', severity: 'HIGH', reason: 'Firebase 클라이언트 설정 (apiKey 박힘 가능)' },
    { glob: '**/firebase-config.ts', severity: 'HIGH', reason: 'Firebase 클라이언트 설정 (TS)' },
    { glob: '**/firebase-adminsdk-*.json', severity: 'CRITICAL', reason: 'Firebase Admin 서비스 어카운트 (절대 클라에 포함 금지)' },
    { glob: '**/service-account*.json', severity: 'CRITICAL', reason: 'GCP 서비스 어카운트' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*|#)/,

  ignorePaths: [
    '**/node_modules/**',
    '**/build/**',
    '**/dist/**',
    '**/.next/**',
    '**/.vite/**',
    '**/coverage/**',
    '**/out/**'
  ],

  getGitignoreTemplate: () => `
# React / frontend build artifacts
node_modules/
build/
dist/
.next/
.vite/
coverage/
out/

# Env files (React/Vite/Next.js)
.env
.env.local
.env.*.local
.env.development
.env.production
`,

  // applyAdvancedFix
  //
  // Skip auto-fix when the match sits inside a zod (or similar validator)
  // fallback chain — `.default(...)`, `.catch(...)`, `.or(...)`. These are
  // intentional fallback values and rewriting them to `process.env.X` breaks
  // the validator's contract: typing of `default()` requires a literal of the
  // schema's inferred type, but `process.env.X` is `string | undefined`.
  // Returning `handled:true, injectedText:''` signals "no-op" — the line is
  // left untouched and no migration is recorded.
  applyAdvancedFix: async ({ lineContent, match }) => {
    const fallbackChain = /\.(?:default|catch|or)\s*\(\s*[`'"][^`'")]*$/;
    const matchIdx = lineContent.indexOf(match);
    if (matchIdx === -1) return { handled: false };
    const before = lineContent.slice(0, matchIdx);
    if (fallbackChain.test(before)) {
      return { handled: true, injectedText: '', replacedText: '', lineContent };
    }
    return { handled: false };
  },

  preFix: async (context) => {
    if (cachedBuildTool === null) {
      const pkg = readPackageJson(context.repoPath);
      cachedBuildTool = detectReactBuildTool(pkg);
      if (!cachedBuildTool) {
        // Defensive: react is present (detect returned true) but no known build
        // tool. Default to CRA-style behavior with a warning.
        cachedBuildTool = 'cra';
        try {
          const { default: logger } = await import('../../utils/logger.js');
          logger.warn('[react] Unknown build tool — falling back to CRA-style REACT_APP_* prefix. Add react-scripts, vite, or next to deps for explicit detection.');
        } catch { /* logger optional */ }
      }
    }

    currentFileClientSide = cachedBuildTool === 'nextjs'
      ? isNextjsClientSideFile(context.relPath, context.absPath)
      : false;
  },

  getAutoFixReplacement: (match, envVarName, ext, options) => {
    return pickAccessor(cachedBuildTool || 'cra', envVarName, currentFileClientSide);
  }
});

// Test-only export so unit tests can inject build tool deterministically
// without triggering preFix lifecycle.
export const __test = {
  pickAccessor,
  isNextjsClientSideFile,
  setBuildTool: (bt) => { cachedBuildTool = bt; },
  getBuildTool: () => cachedBuildTool,
  setClientSide: (v) => { currentFileClientSide = v; },
  resetCache: () => { cachedBuildTool = null; currentFileClientSide = false; }
};
