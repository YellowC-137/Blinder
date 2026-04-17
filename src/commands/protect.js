import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import inquirer from 'inquirer';

export async function protectSecrets(repoPath, scanResults, options = {}) {
  if (scanResults.length === 0) {
    logger.success('No secrets found to protect!');
    return;
  }

  // Group results
  const prodReady = scanResults.filter(r => !r.isTestKey);
  const testKeys = scanResults.filter(r => r.isTestKey);

  const envPath = path.join(repoPath, '.env');
  const envExamplePath = path.join(repoPath, '.env.example');
  
  let envContent = '';
  let envExampleContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  if (fs.existsSync(envExamplePath)) {
    envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
  }

  logger.header('Blinder - Secret Protection');
  if (options.dryRun) {
    logger.warn('RUNNING IN DRY-RUN MODE: No files will be modified.');
  }
  
  const { fixMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'fixMode',
      message: 'Choose protection method:',
      choices: [
        { name: '1. Auto-fix (Recommend: Fully automatic migration)', value: 'auto' },
        { name: '2. Manual (Provide instructions for manual migration)', value: 'manual' }
      ]
    }
  ]);

  const isAutoMode = fixMode === 'auto';
  let allSelectedSecrets = [];

  // Stage 1: Production-ready keys
  if (prodReady.length > 0) {
    logger.info(`Processing ${prodReady.length} production-ready secrets...`);
    if (isAutoMode) {
      logger.success('Auto-fix mode enabled: Migrating secrets automatically.');
    }
    const results = await processSecretGroup(prodReady, envContent, envExampleContent, isAutoMode);
    allSelectedSecrets.push(...results.selected);
    envContent = results.envContent;
    envExampleContent = results.envExampleContent;
  }

  // Stage 2: Test keys (conditional)
  if (testKeys.length > 0) {
    const { includeTests } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'includeTests',
        message: `Found ${testKeys.length} test-related keys. Would you like to process them as well?`,
        default: false
      }
    ]);

    if (includeTests) {
      const results = await processSecretGroup(testKeys, envContent, envExampleContent, isAutoMode);
      allSelectedSecrets.push(...results.selected);
      envContent = results.envContent;
      envExampleContent = results.envExampleContent;
    }
  }

  if (allSelectedSecrets.length > 0) {
    if (!options.dryRun) {
      fs.writeFileSync(envPath, envContent);
      fs.writeFileSync(envExamplePath, envExampleContent);
      logger.success('.env and .env.example updated!');
    } else {
      logger.info(`[Dry-Run] Would update .env and .env.example with ${allSelectedSecrets.length} secrets.`);
    }
    
    if (fixMode === 'auto') {
      logger.info(options.dryRun ? 'Plan: Applying Auto-fix to source code...' : 'Applying Auto-fix to source code...');
      await applyAutoFixes(repoPath, allSelectedSecrets, options);
    } else {
      logger.header('Manual Action Required');
      logger.info('Please replace the secrets in your code with environment variable calls:');
      logger.info('- Flutter: String.fromEnvironment(\'VAR_NAME\')');
      logger.info('- iOS: Use xcconfig or ProcessInfo.processInfo.environment["VAR_NAME"]');
      logger.info('- Android: Use BuildConfig.VAR_NAME');
    }
  } else {
    logger.info('No secrets selected for migration.');
  }
}

async function processSecretGroup(group, envContent, envExampleContent, autoFix = false) {
  const selected = [];
  for (const res of group) {
    const { match, patternName, file, line, isTestKey } = res;
    let secretValue = match;
    if (match.includes('=') || match.includes(':')) {
      const parts = match.split(/[=:]/);
      secretValue = parts[parts.length - 1].trim().replace(/^["']|["']$/g, '');
    }

    const envVarName = patternName.toUpperCase().replace(/\s+/g, '_');
    const label = isTestKey ? '[TEST]' : '[PROD]';
    
    let confirm = autoFix;
    if (!autoFix) {
      const prompt = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `${label} Migrate secret "${logger.maskSecret(secretValue)}" found in ${file}:${line} to ${envVarName}?`,
          default: !isTestKey
        }
      ]);
      confirm = prompt.confirm;
    } else {
      logger.info(`${label} Automatically migrating "${logger.maskSecret(secretValue)}" from ${file}:${line}`);
    }

    if (confirm) {
      selected.push({ ...res, envVarName, secretValue });
      if (!envContent.includes(`${envVarName}=`)) {
        envContent += `${envVarName}=${secretValue}\n`;
        envExampleContent += `${envVarName}=your_secret_here\n`;
      }
    }
  }
  return { selected, envContent, envExampleContent };
}

async function applyAutoFixes(repoPath, secrets, options = {}) {
  const fileGroups = secrets.reduce((acc, s) => {
    if (!acc[s.file]) acc[s.file] = [];
    acc[s.file].push(s);
    return acc;
  }, {});

  for (const [relPath, fileSecrets] of Object.entries(fileGroups)) {
    const absPath = path.join(repoPath, relPath);
    let content = fs.readFileSync(absPath, 'utf8');
    const ext = path.extname(relPath);

    for (const s of fileSecrets) {
      const { match, envVarName } = s;
      let replacement = '';

      if (ext === '.dart') {
        replacement = match.replace(/["'].*?["']/, `String.fromEnvironment('${envVarName}')`);
      } else if (ext === '.kt' || ext === '.java') {
        replacement = match.replace(/["'].*?["']/, `BuildConfig.${envVarName}`);
      } else if (ext === '.swift') {
        replacement = match.replace(/["'].*?["']/, `ProcessInfo.processInfo.environment["${envVarName}"] ?? ""`);
      } else {
        replacement = match.replace(/["'].*?["']/, `process.env.${envVarName}`);
      }

      if (options.dryRun) {
        logger.info(`[Dry-Run] ${relPath}:${s.line} -- Replace ${logger.maskSecret(match)} with ${replacement}`);
      } else {
        content = content.replace(match, replacement);
      }
    }

    if (!options.dryRun) {
      fs.writeFileSync(absPath, content);
      logger.success(`Updated ${relPath}`);
    }
  }
}
