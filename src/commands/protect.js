import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import inquirer from 'inquirer';
import fg from 'fast-glob';
const { glob } = fg;

export async function protectSecrets(repoPath, scanResults, options = {}) {
  // Filter out sensitive file warnings — they are not code-level secrets to migrate
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
  } else {
    logger.info('No secrets selected for migration.');
  }
}

async function processSecretGroup(group, envContent, envExampleContent, autoFix = false) {
  const selected = [];
  for (const res of group) {
    const { match, patternName, file, line, isTestKey } = res;
    let secretValue = match;
    // Skip splitting if it looks like a URL/Endpoint to preserve protocol (https://)
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
      if (!envContent.includes(`${envVarName}=`)) {
        envContent += `${envVarName}=${secretValue}\n`;
        envExampleContent += `${envVarName}=your_secret_here\n`;
      }
    }
  }
  return { selected, envContent, envExampleContent };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isInsideQuotes(lineContent, matchIndex) {
  let inDouble = false;
  let inSingle = false;
  let escape = false;
  for (let i = 0; i < matchIndex; i++) {
    const char = lineContent[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
    } else if (char === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    }
  }
  return inDouble || inSingle;
}

/**
 * Helper to find the best matching platform for a file extension.
 */
function findPlatformForExtension(platforms, ext) {
  const matching = platforms.find(p => (p.commonExtensions || []).includes(ext));
  if (matching) return matching;
  return platforms.find(p => p.id === 'common') || platforms[0];
}

/**
 * Core engine for applying auto-fixes using the 2-stage pipeline.
 * (보안지침 §3: 소스코드 내 하드코딩 제거 및 환경변수 치환)
 */
async function applyAutoFixes(repoPath, results, options = {}) {
  const platforms = options.platforms || [];
  const fileGroups = results.reduce((acc, res) => {
    if (!acc[res.file]) acc[res.file] = [];
    acc[res.file].push(res);
    return acc;
  }, {});

  const migrations = [];

  for (const [relPath, fileSecrets] of Object.entries(fileGroups)) {
    const absPath = path.join(repoPath, relPath);
    if (!fs.existsSync(absPath)) continue;

    const ext = path.extname(relPath);
    const matchingPlatform = findPlatformForExtension(platforms, ext);

    // Lifecycle Hook: preFix
    if (matchingPlatform?.preFix) {
      await matchingPlatform.preFix({ repoPath, relPath, absPath, fileSecrets, options });
    }

    const contentLines = fs.readFileSync(absPath, 'utf8').split('\n');
    let fileModified = false;

    for (const s of fileSecrets) {
      if (s.isSensitiveFile || !s.isFixable) continue;

      const { envVarName, match, fullMatch, line } = s;
      const lineIdx = line - 1;
      if (lineIdx < 0 || lineIdx >= contentLines.length) continue;

      let accessor = '';
      let injectedText = '';
      let replacedText = '';
      let handledByPlatform = false;

      // Stage 1: Advanced Fix
      if (matchingPlatform?.applyAdvancedFix) {
        const advResult = await matchingPlatform.applyAdvancedFix({
          lineContent: contentLines[lineIdx],
          match,
          fullMatch,
          envVarName,
          ext,
          repoPath,
          relPath,
          options,
          migrations,
          logger
        });

        if (advResult.handled) {
          contentLines[lineIdx] = advResult.lineContent;
          injectedText = advResult.injectedText;
          replacedText = advResult.replacedText;
          fileModified = true;
          handledByPlatform = true;
        }
      }

      // Stage 2: Basic Fix
      if (!handledByPlatform) {
        if (matchingPlatform?.getAutoFixReplacement) {
          accessor = matchingPlatform.getAutoFixReplacement(match, envVarName, ext, options);
        } else {
          accessor = `process.env.${envVarName}`;
        }

        let lineContent = contentLines[lineIdx];
        const exactObjc = `@"${match}"`;
        const exactDouble = `"${match}"`;
        const exactSingle = `'${match}'`;

        if (lineContent.includes(exactObjc)) {
          replacedText = exactObjc;
          injectedText = accessor;
          lineContent = lineContent.replace(exactObjc, injectedText);
        } else if (lineContent.includes(exactDouble)) {
          replacedText = exactDouble;
          injectedText = accessor;
          lineContent = lineContent.replace(exactDouble, injectedText);
        } else if (lineContent.includes(exactSingle)) {
          replacedText = exactSingle;
          injectedText = accessor;
          lineContent = lineContent.replace(exactSingle, injectedText);
        } else {
          const isAlphanumeric = /^[a-zA-Z0-9_]+$/.test(match);
          const regex = isAlphanumeric ? new RegExp(`\\b${escapeRegExp(match)}\\b`) : new RegExp(escapeRegExp(match));
          const regexMatch = lineContent.match(regex);
          
          if (regexMatch) {
             const matchIndex = regexMatch.index;
             replacedText = match;
             injectedText = accessor;
             lineContent = lineContent.substring(0, matchIndex) + injectedText + lineContent.substring(matchIndex + match.length);
          }
        }

        if (injectedText) {
          contentLines[lineIdx] = lineContent;
          fileModified = true;
        }
      }

      if (injectedText) {
        migrations.push({
          file: relPath,
          envVarName,
          accessor: accessor || injectedText,
          injectedText,
          replacedText: replacedText || match,
          line: s.line
        });
      }

      if (options.dryRun && injectedText) {
        logger.info(`[Dry-Run] ${relPath}:${s.line} -- Replace ${logger.maskSecret(match)} with ${injectedText}`);
      }
    }

    if (fileModified && !options.dryRun) {
      fs.writeFileSync(absPath, contentLines.join('\n'));
      logger.success(`Updated ${relPath}`);
    }

    // Lifecycle Hook: postFix
    if (matchingPlatform?.postFix) {
      await matchingPlatform.postFix({ repoPath, relPath, absPath, fileSecrets, options, ext, envVarName: fileSecrets[0].envVarName });
    }
  }

  return migrations;
}
