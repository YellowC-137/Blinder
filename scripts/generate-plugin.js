#!/usr/bin/env node

/**
 * Blinder Plugin Scaffolding Tool
 * 
 * Generates a minimal platform plugin file and automatically
 * registers it in the platform registry (src/platforms/index.js).
 * 
 * Usage:
 *   npm run generate-plugin
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('\n🔌 Blinder Plugin Generator\n');
  console.log('새로운 플랫폼 플러그인을 생성합니다.');
  console.log('Create a new platform plugin.\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Platform ID (소문자, 영문. 예: ruby, django):',
      validate: (v) => {
        if (!v) return 'ID는 필수입니다.';
        if (!/^[a-z][a-z0-9_]*$/.test(v)) return '소문자, 숫자, _만 사용하세요 (첫 글자는 영문).';
        return true;
      }
    },
    {
      type: 'input',
      name: 'name',
      message: 'Platform 이름 (사용자 표시용. 예: Ruby on Rails):',
      validate: (v) => v ? true : '이름은 필수입니다.'
    },
    {
      type: 'list',
      name: 'category',
      message: 'Category를 선택하세요:',
      choices: ['backend', 'mobile', 'web']
    },
    {
      type: 'input',
      name: 'extensions',
      message: '스캔할 파일 확장자 (콤마 구분. 예: .rb,.yml):',
      validate: (v) => v ? true : '최소 하나의 확장자가 필요합니다.',
      filter: (v) => v.split(',').map(e => e.trim()).filter(Boolean)
    },
    {
      type: 'input',
      name: 'detectFile',
      message: '프로젝트 감지 파일 (예: Gemfile, pom.xml):',
      validate: (v) => v ? true : '감지 파일은 필수입니다.'
    }
  ]);

  const { id, name, category, extensions, detectFile } = answers;

  // --- 1. Generate plugin file ---
  const categoryDir = path.join(ROOT, 'src', 'platforms', category);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  const pluginPath = path.join(categoryDir, `${id}.js`);
  if (fs.existsSync(pluginPath)) {
    console.error(`\n❌ 이미 존재하는 파일입니다: ${pluginPath}`);
    process.exit(1);
  }

  const extArray = JSON.stringify(extensions);
  const mainExt = extensions[0] || '.txt';

  // Build a simple auto-fix example based on common patterns
  let autoFixBody;
  if (mainExt === '.py') {
    autoFixBody = `return \`os.environ.get("\${envVarName}")\`;`;
  } else if (mainExt === '.rb') {
    autoFixBody = `return \`ENV["\${envVarName}"]\`;`;
  } else if (mainExt === '.java' || mainExt === '.kt') {
    autoFixBody = `return \`System.getenv("\${envVarName}")\`;`;
  } else if (mainExt === '.go') {
    autoFixBody = `return \`os.Getenv("\${envVarName}")\`;`;
  } else if (mainExt === '.rs') {
    autoFixBody = `return \`std::env::var("\${envVarName}").unwrap_or_default()\`;`;
  } else if (mainExt === '.php') {
    autoFixBody = `return \`getenv('\${envVarName}')\`;`;
  } else {
    autoFixBody = `return \`process.env.\${envVarName}\`;`;
  }

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
  console.log(`\n✅ 플러그인 파일 생성: ${path.relative(ROOT, pluginPath)}`);

  // --- 2. Register in index.js ---
  const indexPath = path.join(ROOT, 'src', 'platforms', 'index.js');
  let indexContent = fs.readFileSync(indexPath, 'utf8');

  const importPath = `./${category}/${id}.js`;
  const importLine = `import ${id} from '${importPath}';`;

  // Check if already registered
  if (indexContent.includes(importLine)) {
    console.log(`ℹ️  이미 index.js에 등록되어 있습니다.`);
  } else {
    // Add import after the last existing import
    const lastImportIdx = indexContent.lastIndexOf('import ');
    const lineEnd = indexContent.indexOf('\n', lastImportIdx);
    indexContent = indexContent.substring(0, lineEnd + 1) + importLine + '\n' + indexContent.substring(lineEnd + 1);

    // Add to platforms array (before the closing bracket)
    indexContent = indexContent.replace(
      /(\n\];)/,
      `,\n  ${id}\n];`
    );

    fs.writeFileSync(indexPath, indexContent);
    console.log(`✅ 레지스트리 등록: src/platforms/index.js`);
  }

  // --- 3. Summary ---
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 플러그인이 생성되었습니다!

📁 파일: src/platforms/${category}/${id}.js
📋 등록: src/platforms/index.js

🚀 다음 단계:
  1. 생성된 파일의 detect() 로직을 프로젝트에 맞게 수정하세요.
  2. getAutoFixReplacement()의 치환 코드를 확인하세요.
  3. 테스트: blinder scan --path /your/${id}-project --dry-run
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
