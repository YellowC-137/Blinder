import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import inquirer from 'inquirer';

export async function protectSecrets(repoPath, scanResults, options = {}) {
  // Filter out sensitive file warnings — they are not code-level secrets to migrate
  const codeSecrets = scanResults.filter(r => !r.isSensitiveFile);

  if (codeSecrets.length === 0) {
    logger.success('No secrets found to protect!');
    return;
  }

  // Group results
  const prodReady = codeSecrets.filter(r => !r.isTestKey);
  const testKeys = codeSecrets.filter(r => r.isTestKey);

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
      type: 'rawlist',
      name: 'fixMode',
      message: 'Choose protection method:',
      choices: [
        { name: 'Auto-fix (Recommend: Fully automatic migration)', value: 'auto' },
        { name: 'Manual (Provide instructions for manual migration)', value: 'manual' }
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
    let includeTests = false;
    if (isAutoMode) {
      // Auto mode: include test keys automatically
      logger.info(`Including ${testKeys.length} test-related keys automatically.`);
      includeTests = true;
    } else {
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

    const envVarName = res.envVarName || patternName.toUpperCase().replace(/\s+/g, '_');
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
  const migrations = [];
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
      let accessor = `process.env.${envVarName}`; // Default fallback
      if (options.platforms) {
        for (const p of options.platforms) {
          if (p.commonExtensions && p.commonExtensions.includes(ext) && p.getAutoFixReplacement) {
            accessor = p.getAutoFixReplacement(match, envVarName, ext, {});
            break;
          }
        }
      }

      migrations.push({
        file: relPath,
        envVarName: envVarName,
        accessor: accessor
      });

      if (options.dryRun) {
        logger.info(`[Dry-Run] ${relPath}:${s.line} -- Replace ${logger.maskSecret(match)} with ${accessor}`);
      } else {
        // Attempt to replace the secret along with its surrounding quotes if present
        if (content.includes(`"${match}"`)) {
          content = content.split(`"${match}"`).join(accessor);
        } else if (content.includes(`'${match}'`)) {
          content = content.split(`'${match}'`).join(accessor);
        } else {
          // Fallback for unquoted secrets or secrets embedded within a larger string
          content = content.split(match).join(accessor);
        }
      }
    }

    if (!options.dryRun) {
      fs.writeFileSync(absPath, content);
      logger.success(`Updated ${relPath}`);
    }
  }
  return migrations;
}
