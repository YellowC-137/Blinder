import path from 'path';
import inquirer from 'inquirer';
import logger from '../utils/logger.js';
import { generatePluginFile, registerPlugin } from '../services/pluginService.js';

export async function addPlatform(repoPath) {
  logger.header('Blinder - Add Platform Plugin');
  logger.info('새로운 플랫폼 플러그인을 생성합니다.\n');

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
      name: 'categoryChoice',
      message: 'Category를 선택하세요:',
      choices: [
        { name: '1. Backend', value: 'backend' },
        { name: '2. Frontend', value: 'frontend' },
        { name: '3. Mobile', value: 'mobile' },
        { name: '4. Custom', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customCategory',
      message: '커스텀 Category 이름을 입력하세요 (소문자 영문, 예: infrastructure):',
      when: (answers) => answers.categoryChoice === 'custom',
      validate: (v) => {
        if (!v) return 'Category 이름은 필수입니다.';
        if (!/^[a-z][a-z0-9_]*$/.test(v)) return '소문자, 숫자, _만 사용하세요 (첫 글자는 영문).';
        return true;
      }
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

  const { categoryChoice, customCategory } = answers;
  const category = categoryChoice === 'custom' ? customCategory : categoryChoice;
  const config = { ...answers, category };

  const sourceRoot = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '..');

  try {
    const pluginPath = generatePluginFile(sourceRoot, config);
    logger.success(`플러그인 파일 생성: ${path.relative(sourceRoot, pluginPath)}`);

    if (registerPlugin(sourceRoot, config)) {
      logger.success('레지스트리 등록: platforms/index.js');
    } else {
      logger.info('이미 index.js에 등록되어 있거나 파일을 찾을 수 없습니다.');
    }

    logger.divider();
    logger.success('플러그인이 생성되었습니다!');
    logger.info(`📁 파일: src/platforms/${category}/${config.id}.js`);
    logger.divider();
    logger.info('🚀 다음 단계:');
    logger.info('  1. 생성된 파일의 detect() 로직을 프로젝트에 맞게 수정하세요.');
    logger.info('  2. getAutoFixReplacement()의 치환 코드를 확인하세요.');
    logger.info('  3. 테스트: blinder scan --path /your/project --dry-run');

  } catch (err) {
    logger.error(err.message);
  }
}
