import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import inquirer from 'inquirer';
import { applyAutoFixes, prepareEnvContent } from '../services/protectionService.js';
import { t } from '../utils/i18n.js';

export async function protectSecrets(repoPath, scanResults, options = {}) {
  // Filter out sensitive file warnings
  const codeSecrets = scanResults.filter(r => !r.isSensitiveFile);

  if (codeSecrets.length === 0) {
    logger.success('No secrets found to protect!');
    return;
  }

  // Group results
  const fixableSecrets = codeSecrets.filter(r => r.isFixable !== false);
  const prodReady = fixableSecrets.filter(r => !r.isTestKey);
  const testKeys = fixableSecrets.filter(r => r.isTestKey);

  if (fixableSecrets.length === 0) {
    logger.success('No fixable secrets found. Generating reports only.');
    return;
  }

  const envPath = path.join(repoPath, '.env');
  const envExamplePath = path.join(repoPath, '.env.example');
  
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  let envExampleContent = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, 'utf8') : '';

  logger.header('Blinder - Secret Protection');
  if (options.dryRun) {
    logger.warn('RUNNING IN DRY-RUN MODE: No files will be modified.');
  }
  
  let fixMode = options.mode;

  if (!fixMode) {
    const answer = await inquirer.prompt([
      {
        type: 'rawlist',
        name: 'fixMode',
        message: 'Choose protection method:',
        choices: [
          { name: 'Auto-fix (Recommend: Fully automatic migration)', value: 'auto' },
          { name: 'Manual (Provide instructions for manual migration)', value: 'manual' }
        ]
      }
    ]);
    fixMode = answer.fixMode;
  }

  const isAutoMode = fixMode === 'auto';
  let allSelectedSecrets = [];

  // Stage 1: Production-ready keys
  if (prodReady.length > 0) {
    logger.info(`Processing ${prodReady.length} production-ready secrets...`);
    const results = await processSecretGroupInteraction(prodReady, isAutoMode);
    
    const envUpdate = prepareEnvContent(results, envContent);
    allSelectedSecrets.push(...envUpdate.selected);
    envContent = envUpdate.envContent;
    envExampleContent += envUpdate.envExampleContent;
  }

  // Stage 2: Test keys (conditional)
  if (testKeys.length > 0) {
    let includeTests = isAutoMode;
    if (!isAutoMode) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'includeTests',
          message: `Found ${testKeys.length} test-related keys. Would you like to process them as well?`,
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
      logger.success('.env and .env.example updated!');
    }
    
    if (fixMode === 'auto') {
      logger.info(options.dryRun ? 'Plan: Applying Auto-fix to source code...' : 'Applying Auto-fix to source code...');
      const migrations = await applyAutoFixes(repoPath, allSelectedSecrets, options);
      
      if (!options.dryRun && migrations.length > 0) {
        const metadataPath = path.join(repoPath, '.blinder_protect.json');
        const metadata = {
          version: '1.0',
          createdAt: new Date().toISOString(),
          migrations: migrations
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        logger.success('Rollback metadata saved to .blinder_protect.json');
      }
    } else {
      showManualInstructions();
    }
  } else {
    logger.info('No secrets selected for migration.');
  }
}

async function processSecretGroupInteraction(group, autoFix = false) {
  const selected = [];
  for (const res of group) {
    const { match, patternName, file, line, isTestKey } = res;
    let secretValue = match;
    if ((match.includes('=') || match.includes(':')) && !match.includes('://')) {
      const parts = match.split(/[=:]/);
      secretValue = parts[parts.length - 1].trim().replace(/^["']|["']$/g, '');
    }

    const envVarName = res.envVarName || patternName.toUpperCase().replace(/\s+/g, '_');
    const label = isTestKey ? '[TEST]' : '[PROD]';
    
    let confirm = autoFix;
    if (!autoFix) {
      const prompt = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `${label} Found secret "${logger.maskSecret(secretValue)}" in ${file}:${line}. Migrate to ${envVarName}?`,
          default: !isTestKey
        }
      ]);
      confirm = prompt.confirm;
    } else {
      logger.info(`${label} Automatically migrating "${logger.maskSecret(secretValue)}" from ${file}:${line}`);
    }

    if (confirm) {
      selected.push({ ...res, envVarName, secretValue });
    }
  }
  return selected;
}

function showManualInstructions() {
  logger.header('Manual Action Required');
  logger.info('To complete the migration, please replace the hardcoded secrets in your source code with environment variable lookups:');
  logger.divider();
  logger.info(chalk.bold('Implementation Examples:'));
  logger.info(`- ${chalk.yellow('Flutter')}:   String.fromEnvironment('VAR_NAME')`);
  logger.info(`- ${chalk.yellow('iOS')}:       Use xcconfig or ProcessInfo.processInfo.environment["VAR_NAME"]`);
  logger.info(`- ${chalk.yellow('Android')}:   Use BuildConfig.VAR_NAME`);
  logger.info(`- ${chalk.yellow('Node.js')}:   process.env.VAR_NAME`);
  logger.divider();
  logger.success('The .env file has been updated with your secrets. You can now use these variables.');
}
