import path from 'path';
import inquirer from 'inquirer';
import logger from '../utils/logger.js';
import { generatePluginFile, registerPlugin } from '../services/pluginService.js';
import { t } from '../utils/i18n.js';

interface AddPlatformAnswers {
  id: string;
  name: string;
  categoryChoice: string;
  customCategory?: string;
  extensions: string[];
  detectFile: string;
}

export async function addPlatform(repoPath: string): Promise<void> {
  logger.header(t('add_platform_header'));
  logger.info(t('add_platform_start'));

  const answers = await inquirer.prompt<AddPlatformAnswers>([
    {
      type: 'input',
      name: 'id',
      message: t('add_platform_prompt_id'),
      validate: (v: string): string | true => {
        if (!v) return t('add_platform_err_id_req');
        if (!/^[a-z][a-z0-9_]*$/.test(v)) return t('add_platform_err_id_fmt');
        return true;
      }
    },
    {
      type: 'input',
      name: 'name',
      message: t('add_platform_prompt_name'),
      validate: (v: string): string | true => v ? true : t('add_platform_err_name_req')
    },
    {
      type: 'list',
      name: 'categoryChoice',
      message: t('add_platform_prompt_cat'),
      choices: [
        { name: t('add_platform_cat_backend'), value: 'backend' },
        { name: t('add_platform_cat_frontend'), value: 'frontend' },
        { name: t('add_platform_cat_mobile'), value: 'mobile' },
        { name: t('add_platform_cat_custom'), value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customCategory',
      message: t('add_platform_prompt_custom_cat'),
      when: (answers: Partial<AddPlatformAnswers>): boolean => answers.categoryChoice === 'custom',
      validate: (v: string): string | true => {
        if (!v) return t('add_platform_err_cat_req');
        if (!/^[a-z][a-z0-9_]*$/.test(v)) return t('add_platform_err_cat_fmt');
        return true;
      }
    },
    {
      type: 'input',
      name: 'extensions',
      message: t('add_platform_prompt_ext'),
      validate: (v: string): string | true => v ? true : t('add_platform_err_ext_req'),
      filter: (v: string): string[] => v.split(',').map((e: string) => e.trim()).filter(Boolean)
    },
    {
      type: 'input',
      name: 'detectFile',
      message: t('add_platform_prompt_detect'),
      validate: (v: string): string | true => v ? true : t('add_platform_err_detect_req')
    }
  ]);

  const { categoryChoice, customCategory } = answers;
  const category: string = categoryChoice === 'custom' ? (customCategory as string) : categoryChoice;
  const config = { ...answers, category };

  const sourceRoot: string = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

  try {
    const pluginPath: string = generatePluginFile(sourceRoot, config);
    logger.success(t('add_platform_created', { path: path.relative(sourceRoot, pluginPath) }));

    if (registerPlugin(sourceRoot, config)) {
      logger.success(t('add_platform_registered'));
    } else {
      logger.info(t('add_platform_already_reg'));
    }

    logger.divider();
    logger.success(t('add_platform_success'));
    logger.info(t('add_platform_file_path', { cat: category, id: config.id }));
    logger.divider();
    logger.info(t('add_platform_next_steps'));
    logger.info(t('add_platform_step1'));
    logger.info(t('add_platform_step2'));
    logger.info(t('add_platform_step3'));

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
  }
}
