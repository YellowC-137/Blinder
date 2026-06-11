import fs from 'fs';
import { definePlatform } from '../definePlatform.js';
import { readPackageJson, hasRuntimeDep, detectReactBuildTool } from '../../utils/packageJsonReader.js';
import type { ReactBuildTool } from '../../utils/packageJsonReader.js';
import { t } from '../../utils/i18n.js';
import type { AdvancedFixContext, AdvancedFixResult, PreFixContext } from '../types.js';

// 빌드툴 / 클라이언트사이드 플래그를 repoPath 별로 캐시.
// 이전 구현은 모듈 전역 `let` 사용 — CLI 단일 호출 한정으로는 동작하지만
// 단위 테스트에서 상태 leak / 동시 호출 시 race 발생. Map 으로 격리.
//
// 키: 정규화된 repoPath (string)
// 값: { buildTool: 'cra'|'vite'|'nextjs', clientSide: boolean }
const repoState = new Map<string, { buildTool: ReactBuildTool | null; clientSide: boolean }>();

// 현재 처리 중인 repoPath — getAutoFixReplacement 시그니처에 repoPath 가 없어
// preFix 에서 단일 변수로 전달. CLI 는 한 번에 한 리포만 처리하므로 안전.
let activeRepoPath: string | null = null;

function getState(repoPath: string): { buildTool: ReactBuildTool | null; clientSide: boolean } {
  let s = repoState.get(repoPath);
  if (!s) {
    s = { buildTool: null, clientSide: false };
    repoState.set(repoPath, s);
  }
  return s;
}

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
function isNextjsClientSideFile(relPath: string, absPath: string): boolean {
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

function pickAccessor(buildTool: ReactBuildTool | null, envVarName: string, isClientSide: boolean = false): string {
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
  detect: async (repoPath: string): Promise<boolean> => {
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

  getGitignoreTemplate: (): string => `
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
  applyAdvancedFix: async ({ lineContent, match }: AdvancedFixContext): Promise<AdvancedFixResult> => {
    const fallbackChain = /\.(?:default|catch|or)\s*\(\s*[`'"][^`'")]*$/;
    const matchIdx = lineContent.indexOf(match);
    if (matchIdx === -1) return { handled: false };
    const before = lineContent.slice(0, matchIdx);
    if (fallbackChain.test(before)) {
      return { handled: true, injectedText: '', replacedText: '', lineContent };
    }
    return { handled: false };
  },

  preFix: async (context: PreFixContext): Promise<void> => {
    activeRepoPath = context.repoPath;
    const state = getState(activeRepoPath);

    if (state.buildTool === null) {
      const pkg = readPackageJson(context.repoPath);
      state.buildTool = detectReactBuildTool(pkg);
      if (!state.buildTool) {
        // 방어 분기: react 는 감지됐지만 알려진 빌드툴 없음. CRA 동작으로 fallback.
        state.buildTool = 'cra';
        try {
          const { default: logger } = await import('../../utils/logger.js');
          logger.warn(t('react_unknown_build_tool'));
        } catch { /* logger optional */ }
      }
    }

    state.clientSide = state.buildTool === 'nextjs'
      ? isNextjsClientSideFile(context.relPath, context.absPath)
      : false;
  },

  getAutoFixReplacement: (match: string, envVarName: string, ext: string, options?: Record<string, unknown>): string => {
    const state = activeRepoPath ? getState(activeRepoPath) : { buildTool: 'cra' as ReactBuildTool, clientSide: false };
    return pickAccessor(state.buildTool || 'cra', envVarName, state.clientSide);
  }
});

// 단위 테스트 전용 — preFix 라이프사이클 거치지 않고 상태 주입.
export const __test = {
  pickAccessor,
  isNextjsClientSideFile,
  setBuildTool: (bt: ReactBuildTool | null): void => {
    const repo = activeRepoPath || '__test__';
    activeRepoPath = repo;
    getState(repo).buildTool = bt;
  },
  getBuildTool: (): ReactBuildTool | null => activeRepoPath ? getState(activeRepoPath).buildTool : null,
  setClientSide: (v: boolean): void => {
    const repo = activeRepoPath || '__test__';
    activeRepoPath = repo;
    getState(repo).clientSide = v;
  },
  resetCache: (): void => {
    repoState.clear();
    activeRepoPath = null;
  }
};
