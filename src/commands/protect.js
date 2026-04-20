import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
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

async function applyAutoFixes(repoPath, secrets, options = {}) {
  const migrations = [];
  const fileGroups = secrets.reduce((acc, s) => {
    if (!acc[s.file]) acc[s.file] = [];
    acc[s.file].push(s);
    return acc;
  }, {});

  for (const [relPath, fileSecrets] of Object.entries(fileGroups)) {
    const absPath = path.join(repoPath, relPath);
    const contentLines = fs.readFileSync(absPath, 'utf8').split('\n');
    const ext = path.extname(relPath);

    for (const s of fileSecrets) {
      const { match, envVarName, line } = s;
      const lineIdx = line - 1;
      
      if (lineIdx < 0 || lineIdx >= contentLines.length) continue;

      let accessor = '';
      let inlineAccessor = '';

      if (ext === '.dart') {
        accessor = `String.fromEnvironment('${envVarName}')`;
        inlineAccessor = "$" + `{${accessor}}`;
      } else if (ext === '.kt') {
        accessor = `BuildConfig.${envVarName}`;
        inlineAccessor = "$" + `{${accessor}}`;
      } else if (ext === '.java') {
        accessor = `BuildConfig.${envVarName}`;
        inlineAccessor = `" + ${accessor} + "`;
      } else if (ext === '.swift') {
        accessor = `ProcessInfo.processInfo.environment["${envVarName}"] ?? ""`;
        inlineAccessor = `\\(${accessor})`;
      } else if (ext === '.m' || ext === '.mm' || ext === '.h') {
        accessor = `[[[NSProcessInfo processInfo] environment] objectForKey:@"${envVarName}"]`;
        inlineAccessor = accessor; // String interpolation not natively aligned, safe fallback
      } else if (ext === '.plist' || ext === '.xcconfig') {
        accessor = `\$(${envVarName})`;
        inlineAccessor = accessor;
      } else if (ext === '.xml') {
        accessor = "$" + `{${envVarName}}`; // Android Manifest or values placeholders
        inlineAccessor = accessor;
      } else if (ext === '.gradle') {
        accessor = `System.getenv('${envVarName}') ?: ""`;
        inlineAccessor = "$" + `{System.getenv('${envVarName}') ?: ""}`;
      } else if (ext === '.json') {
        accessor = `process.env.${envVarName}`;
        inlineAccessor = accessor;
      } else {
        accessor = `process.env.${envVarName}`;
        inlineAccessor = "$" + `{${accessor}}`; // Fallback for JS/others using template literal
      }

      let lineContent = contentLines[lineIdx];
      let replacedText = match;

      if (!options.dryRun && lineContent) {
        const exactDouble = `"${match}"`;
        const exactSingle = `'${match}'`;

        // We only want to replace the FIRST occurrence on this line that matches our rules,
        // because we don't want to replace all occurrences if only one was intended.
        // Actually, replacing all occurrences *on this single line* is usually safe if it's the exact same secret.
        
        if (lineContent.includes(exactDouble)) {
          replacedText = exactDouble;
          lineContent = lineContent.replace(exactDouble, accessor);
        } else if (lineContent.includes(exactSingle)) {
          replacedText = exactSingle;
          lineContent = lineContent.replace(exactSingle, accessor);
        } else {
          // It's either embedded in a string, or an unquoted identifier / literal
          const isAlphanumeric = /^[a-zA-Z0-9_]+$/.test(match);
          const regex = isAlphanumeric ? new RegExp(`\\b${escapeRegExp(match)}\\b`) : new RegExp(escapeRegExp(match));
          
          const regexMatch = lineContent.match(regex);
          if (regexMatch) {
             const matchIndex = regexMatch.index;
             if (isInsideQuotes(lineContent, matchIndex)) {
               replacedText = match;
               lineContent = lineContent.substring(0, matchIndex) + inlineAccessor + lineContent.substring(matchIndex + match.length);
             } else {
               replacedText = match;
               lineContent = lineContent.substring(0, matchIndex) + accessor + lineContent.substring(matchIndex + match.length);
             }
          } else {
             logger.warn(`Could not safely replace "${match}" on line ${lineIdx + 1} in ${relPath}. (No word boundary or valid structural match found). Skipping.`);
          }
        }
      }

      migrations.push({
        file: relPath,
        envVarName: envVarName,
        accessor: accessor,
        replacedText: replacedText
      });

      if (!options.dryRun) {
        contentLines[lineIdx] = lineContent;
      } else {
        logger.info(`[Dry-Run] ${relPath}:${s.line} -- Replace ${logger.maskSecret(match)} with ${accessor}`);
      }
    }

    if (!options.dryRun) {
      fs.writeFileSync(absPath, contentLines.join('\n'));
      logger.success(`Updated ${relPath}`);
    }
  }
  return migrations;
}
