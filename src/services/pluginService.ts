import fs from 'fs';
import path from 'path';

interface PluginConfig {
  id: string;
  name: string;
  category: string;
  extensions: string[];
  detectFile: string;
}

/**
 * generatePluginFile
 */
export function generatePluginFile(sourceRoot: string, config: PluginConfig): string {
  const { id, name, category, extensions, detectFile } = config;

  // Validate id to prevent path traversal
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    throw new Error(`Invalid plugin id "${id}": must match /^[a-z][a-z0-9_]*$/`);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(category)) {
    throw new Error(`Invalid category "${category}": must match /^[a-z][a-z0-9_]*$/`);
  }

  const categoryDir = path.join(sourceRoot, 'platforms', category);
  
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  const pluginPath = path.join(categoryDir, `${id}.ts`);
  if (fs.existsSync(pluginPath)) {
    throw new Error(`Plugin file already exists: ${pluginPath}`);
  }

  const extArray = JSON.stringify(extensions);
  const mainExt = extensions[0] || '.txt';

  let autoFixBody: string;
  if (mainExt === '.py') autoFixBody = `return \`os.environ.get("\${envVarName}")\`;`;
  else if (mainExt === '.rb') autoFixBody = `return \`ENV["\${envVarName}"]\`;`;
  else if (mainExt === '.java' || mainExt === '.kt') autoFixBody = `return \`System.getenv("\${envVarName}")\`;`;
  else if (mainExt === '.go') autoFixBody = `return \`os.Getenv("\${envVarName}")\`;`;
  else if (mainExt === '.rs') autoFixBody = `return \`std::env::var("\${envVarName}").unwrap_or_default()\`;`;
  else if (mainExt === '.php') autoFixBody = `return \`getenv('\${envVarName}')\`;`;
  else autoFixBody = `return \`process.env.\${envVarName}\`;`;

  // Escape user-provided strings for safe template interpolation
  const esc = (s: string): string => String(s).replace(/[`$\\]/g, '\\$&');

  const pluginContent = `import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: '${esc(id)}',
  name: '${esc(name)}',
  category: '${esc(category)}',

  // 프로젝트 감지: ${esc(detectFile)}가 있으면 ${esc(name)} 프로젝트로 인식
  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, '${esc(detectFile)}'));
  },

  // 스캔 대상 확장자
  commonExtensions: ${extArray},

  // 환경 변수 접근자 코드 생성
  getAutoFixReplacement: (match, envVarName, ext, options) => {
    ${autoFixBody}
  }
});
`;

  fs.writeFileSync(pluginPath, pluginContent);
  return pluginPath;
}

/**
 * registerPlugin
 */
export function registerPlugin(sourceRoot: string, config: PluginConfig): boolean {
  const { id, category } = config;
  // TS 소스 레지스트리 우선, (컴파일 산출물에서 실행된 경우) JS fallback
  let indexPath = path.join(sourceRoot, 'platforms', 'index.ts');
  if (!fs.existsSync(indexPath)) indexPath = path.join(sourceRoot, 'platforms', 'index.js');
  if (!fs.existsSync(indexPath)) return false;

  let indexContent = fs.readFileSync(indexPath, 'utf8');
  const importPath = `./${category}/${id}.js`;
  const importLine = `import ${id} from '${importPath}';`;

  if (indexContent.includes(importLine)) return false;

  // Find last import statement using regex for robustness
  const importMatches = [...indexContent.matchAll(/^import\s+.+$/gm)];
  if (importMatches.length === 0) return false;
  const lastImport = importMatches[importMatches.length - 1];
  const lineEnd = lastImport.index! + lastImport[0].length;
  indexContent = indexContent.substring(0, lineEnd) + '\n' + importLine + indexContent.substring(lineEnd);

  indexContent = indexContent.replace(
    /(\n\];)/,
    `,\n  ${id}\n];`
  );

  fs.writeFileSync(indexPath, indexContent);
  return true;
}
