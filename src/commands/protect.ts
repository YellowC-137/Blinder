import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import inquirer from 'inquirer';
import { applyAutoFixes, prepareEnvContent } from '../services/protectionService.js';
import { t } from '../utils/i18n.js';
import type { ProtectionOptions } from '../platforms/types.js';
import type { ScanResult, CodeSecretMatch, Migration } from '../types/index.js';


export async function protectSecrets(repoPath: string, scanResults: ScanResult[], options: ProtectionOptions = {}): Promise<void> {
  // Filter out sensitive file warnings
  const codeSecrets = scanResults.filter((r): r is CodeSecretMatch => !r.isSensitiveFile);

  if (codeSecrets.length === 0) {
    logger.success(t('protect_no_secrets'));
    return;
  }

  // Commented-out secret lines are NOT auto-replaced — they're already inert
  // code and rewriting them to env-var calls would introduce dead env lookups.
  // Surface them so the user can delete the lines manually.
  const commentedSecrets = codeSecrets.filter((r: CodeSecretMatch) => r.isComment);
  const liveSecrets = codeSecrets.filter((r: CodeSecretMatch) => !r.isComment);

  if (commentedSecrets.length > 0) {
    logger.warn(t('commented_protect_warn', { count: commentedSecrets.length }));
    commentedSecrets.forEach((r: CodeSecretMatch) => {
      logger.info(`  - ${r.file}:${r.line}  ${r.patternName}`);
      logger.info(`      ${r.content}`);
    });
    logger.info(t('commented_protect_hint'));
  }

  // Group results
  const fixableSecrets = liveSecrets.filter((r: CodeSecretMatch) => r.isFixable !== false);
  const prodReady = fixableSecrets.filter((r: CodeSecretMatch) => !r.isTestKey);
  const testKeys = fixableSecrets.filter((r: CodeSecretMatch) => r.isTestKey);

  if (fixableSecrets.length === 0) {
    logger.success(t('protect_no_fixable'));
    return;
  }

  const envPath: string = path.join(repoPath, '.env');
  const envExamplePath: string = path.join(repoPath, '.env.example');
  
  let envContent: string = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  let envExampleContent: string = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, 'utf8') : '';

  logger.header(t('protect_header'));
  if (options.dryRun) {
    logger.warn(t('dryrun_warn'));
  }
  
  let fixMode: string | undefined = options.mode;

  if (!fixMode) {
    const answer = await inquirer.prompt<{ fixMode: string }>([
      {
        type: 'rawlist',
        name: 'fixMode',
        message: t('prompt_choose_proceed'),
        choices: [
          { name: t('choice_auto'), value: 'auto' },
          { name: t('choice_manual'), value: 'manual' }
        ]
      }
    ]);
    fixMode = answer.fixMode;
  }

  const isAutoMode: boolean = fixMode === 'auto';
  const allSelectedSecrets: Array<ScanResult & { envVarName: string; secretValue: string }> = [];

  // Stage 1: Production-ready keys
  if (prodReady.length > 0) {
    logger.info(t('protect_processing_prod', { count: prodReady.length }));
    const results = await processSecretGroupInteraction(prodReady, isAutoMode);
    
    const envUpdate = prepareEnvContent(results, envContent);
    allSelectedSecrets.push(...envUpdate.selected);
    envContent = envUpdate.envContent;
    envExampleContent += envUpdate.envExampleContent;
  }

  // Stage 2: Test keys (conditional)
  if (testKeys.length > 0) {
    let includeTests: boolean = isAutoMode;
    if (!isAutoMode) {
      const answer = await inquirer.prompt<{ includeTests: boolean }>([
        {
          type: 'confirm',
          name: 'includeTests',
          message: t('prompt_include_tests', { count: testKeys.length }),
          default: false
        }
      ]);
      includeTests = answer.includeTests;
    }

    if (includeTests) {
      const results = await processSecretGroupInteraction(testKeys, isAutoMode);
      const envUpdate = prepareEnvContent(results, envContent);
      allSelectedSecrets.push(...envUpdate.selected);
      envContent = envUpdate.envContent;
      envExampleContent += envUpdate.envExampleContent;
    }
  }

  if (allSelectedSecrets.length > 0) {
    if (!options.dryRun) {
      fs.writeFileSync(envPath, envContent);
      fs.writeFileSync(envExamplePath, envExampleContent);
      logger.success(t('protect_env_updated'));
    }
    
    if (fixMode === 'auto') {
      logger.info(options.dryRun ? t('protect_plan_autofix') : t('protect_apply_autofix'));
      const migrations: Migration[] = await applyAutoFixes(repoPath, allSelectedSecrets, options);
      
      if (!options.dryRun && migrations.length > 0) {
        const metadataPath: string = path.join(repoPath, '.blinder_protect.json');
        const metadata = {
          version: '1.0',
          createdAt: new Date().toISOString(),
          migrations: migrations
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        logger.success(t('protect_metadata_saved'));
      }
    } else {
      showManualInstructions();
    }
  } else {
    logger.info(t('protect_no_selection'));
  }
}

async function processSecretGroupInteraction(group: CodeSecretMatch[], autoFix: boolean = false): Promise<Array<CodeSecretMatch & { envVarName: string; secretValue: string }>> {
  const selected: Array<CodeSecretMatch & { envVarName: string; secretValue: string }> = [];
  for (const res of group) {
    const { match, patternName, file, line, isTestKey } = res;
    let secretValue: string = match;
    if ((match.includes('=') || match.includes(':')) && !match.includes('://')) {
      const parts: string[] = match.split(/[=:]/);
      secretValue = parts[parts.length - 1].trim().replace(/^["']|["']$/g, '');
    }

    const envVarName: string = res.envVarName || patternName.toUpperCase().replace(/\s+/g, '_');
    const label: string = isTestKey ? '[TEST]' : '[PROD]';
    
    let confirm: boolean = autoFix;
    if (!autoFix) {
      const prompt = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: t('protect_prompt_migrate', { label, secret: logger.maskSecret(secretValue), file, line, env: envVarName }),
          default: !isTestKey
        }
      ]);
      confirm = prompt.confirm;
    } else {
      logger.info(t('protect_auto_migrating', { label, secret: logger.maskSecret(secretValue), file, line }));
    }

    if (confirm) {
      selected.push({ ...res, envVarName, secretValue });
    }
  }
  return selected;
}

function showManualInstructions(): void {
  logger.header(t('protect_manual_req'));
  logger.info(t('protect_manual_desc'));
  logger.divider();
  logger.info(chalk.bold(t('protect_manual_examples')));
  logger.info(t('protect_manual_flutter', { platform: chalk.yellow('Flutter') }));
  logger.info(t('protect_manual_ios', { platform: chalk.yellow('iOS') }));
  logger.info(t('protect_manual_android', { platform: chalk.yellow('Android') }));
  logger.info(t('protect_manual_node', { platform: chalk.yellow('Node.js') }));
  logger.divider();
  logger.success(t('protect_manual_success'));
}
