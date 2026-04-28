import { definePlatform } from '../definePlatform.js';
import { readPackageJson, isFrontendProject } from '../../utils/packageJsonReader.js';

export default definePlatform({
  id: 'node',
  name: 'Node.js',
  category: 'backend',
  astLanguage: 'javascript',

  // Detect: package.json present AND not a frontend project
  // (frontend projects belong to React/Vue/etc. plugins)
  detect: async (repoPath) => {
    const pkg = readPackageJson(repoPath);
    if (!pkg) return false;
    if (isFrontendProject(pkg)) return false;
    return true;
  },

  commonExtensions: ['.js', '.mjs', '.cjs', '.ts'],

  sensitiveFiles: [
    { glob: '**/.npmrc', severity: 'CRITICAL', reason: 'npm auth token 포함 가능' },
    { glob: '**/.yarnrc.yml', severity: 'HIGH', reason: 'yarn registry/auth 설정' },
    { glob: '**/.env', severity: 'HIGH', reason: 'Node 런타임 환경변수' },
    { glob: '**/.env.*', severity: 'HIGH', reason: '환경변수 변형 (.env.local 등)' },
    { glob: '**/firebase-adminsdk-*.json', severity: 'CRITICAL', reason: 'Firebase Admin 서비스 어카운트' },
    { glob: '**/service-account*.json', severity: 'CRITICAL', reason: 'GCP 서비스 어카운트' },
    { glob: '**/.aws/credentials', severity: 'CRITICAL', reason: 'AWS 자격증명' },
    { glob: '**/ecosystem.config.js', severity: 'MEDIUM', reason: 'pm2 설정에 시크릿 가능' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*|#)/,

  ignorePaths: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.nyc_output/**',
    '**/.next/**'
  ],

  getGitignoreTemplate: () => `
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.env
.env.local
.env.*.local
dist/
build/
coverage/
.nyc_output/
*.tsbuildinfo
.npm/
`,

  getAutoFixReplacement: (match, envVarName, ext, options) => {
    return `process.env.${envVarName}`;
  }
});
