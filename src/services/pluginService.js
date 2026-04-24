import fs from 'fs';
import path from 'path';

/**
 * generatePluginFile
 */
export function generatePluginFile(sourceRoot, config) {
  const { id, name, category, extensions, detectFile } = config;
  const categoryDir = path.join(sourceRoot, 'platforms', category);
  
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  const pluginPath = path.join(categoryDir, `${id}.js`);
  if (fs.existsSync(pluginPath)) {
    throw new Error(`Plugin file already exists: ${pluginPath}`);
  }

  const extArray = JSON.stringify(extensions);
  const mainExt = extensions[0] || '.txt';

  let autoFixBody;
  if (mainExt === '.py') autoFixBody = `return \`os.environ.get("\${envVarName}")\`;`;
  else if (mainExt === '.rb') autoFixBody = `return \`ENV["\${envVarName}"]\`;`;
  else if (mainExt === '.java' || mainExt === '.kt') autoFixBody = `return \`System.getenv("\${envVarName}")\`;`;
  else if (mainExt === '.go') autoFixBody = `return \`os.Getenv("\${envVarName}")\`;`;
  else if (mainExt === '.rs') autoFixBody = `return \`std::env::var("\${envVarName}").unwrap_or_default()\`;`;
  else if (mainExt === '.php') autoFixBody = `return \`getenv('\${envVarName}')\`;`;
  else autoFixBody = `return \`process.env.\${envVarName}\`;`;

  const pluginContent = `import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: '${id}',
  name: '${name}',
  category: '${category}',

  // 프로젝트 감지: ${detectFile}가 있으면 ${name} 프로젝트로 인식
  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, '${detectFile}'));
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
export function registerPlugin(sourceRoot, config) {
  const { id, category } = config;
  const indexPath = path.join(sourceRoot, 'platforms', 'index.js');
  if (!fs.existsSync(indexPath)) return false;

  let indexContent = fs.readFileSync(indexPath, 'utf8');
  const importPath = `./${category}/${id}.js`;
  const importLine = `import ${id} from '${importPath}';`;

  if (indexContent.includes(importLine)) return false;

  const lastImportIdx = indexContent.lastIndexOf('import ');
  const lineEnd = indexContent.indexOf('\n', lastImportIdx);
  indexContent = indexContent.substring(0, lineEnd + 1) + importLine + '\n' + indexContent.substring(lineEnd + 1);

  indexContent = indexContent.replace(
    /(\n\];)/,
    `,\n  ${id}\n];`
  );

  fs.writeFileSync(indexPath, indexContent);
  return true;
}
