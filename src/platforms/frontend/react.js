import { definePlatform } from '../definePlatform.js';
import { readPackageJson, hasDep, detectReactBuildTool } from '../../utils/packageJsonReader.js';

// Build-tool detection runs once per repo via preFix and is cached here so
// getAutoFixReplacement (which lacks repoPath) can read it. CLI runs target
// one repo per invocation, so a single module-level slot is sufficient.
let cachedBuildTool = null;

function pickAccessor(buildTool, envVarName) {
  switch (buildTool) {
    case 'cra':
      // CRA exposes only REACT_APP_* env vars to the bundle
      return `process.env.REACT_APP_${envVarName}`;
    case 'vite':
      return `import.meta.env.VITE_${envVarName}`;
    case 'nextjs':
      // Conservative default: server-side accessor. Client-only secrets need
      // NEXT_PUBLIC_ prefix and explicit user opt-in (see warning in plugin).
      return `process.env.${envVarName}`;
    default:
      return `process.env.${envVarName}`;
  }
}

export default definePlatform({
  id: 'react',
  name: 'React',
  category: 'frontend',
  astLanguage: 'tsx',

  // Detect: package.json with `react` as direct or peer/dev dependency.
  // Note: order in src/platforms/index.js places React before node so that a
  // React project does not double-match Node (Node detect already excludes
  // frontend projects via isFrontendProject helper).
  detect: async (repoPath) => {
    const pkg = readPackageJson(repoPath);
    if (!pkg) return false;
    return hasDep(pkg, 'react');
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

  preFix: async (context) => {
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
  },

  getAutoFixReplacement: (match, envVarName, ext, options) => {
    return pickAccessor(cachedBuildTool || 'cra', envVarName);
  }
});

// Test-only export so unit tests can inject build tool deterministically
// without triggering preFix lifecycle.
export const __test = {
  pickAccessor,
  setBuildTool: (bt) => { cachedBuildTool = bt; },
  getBuildTool: () => cachedBuildTool
};
