import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import inquirer from 'inquirer';

export async function protectSecrets(repoPath, scanResults) {
  if (scanResults.length === 0) {
    logger.success('No secrets found to protect!');
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
  
  const { fixMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'fixMode',
      message: 'Choose protection method:',
      choices: [
        { name: 'Auto-fix (Migrate to .env and replace in source code)', value: 'auto' },
        { name: 'Manual (Migrate to .env and provide manual instructions)', value: 'manual' }
      ]
    }
  ]);

  const secretsToMigrate = [];
  
  for (const res of scanResults) {
    const { match, patternName, file, line } = res;
    // Extract actual secret value if it's a "key=val" match
    let secretValue = match;
    if (match.includes('=') || match.includes(':')) {
      const parts = match.split(/[=:]/);
      secretValue = parts[parts.length - 1].trim().replace(/^["']|["']$/g, '');
    }

    const envVarName = patternName.toUpperCase().replace(/\s+/g, '_');
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Migrate secret "${secretValue}" found in ${file}:${line} to env var ${envVarName}?`,
        default: true
      }
    ]);

    if (confirm) {
      secretsToMigrate.push({ ...res, envVarName, secretValue });
      
      if (!envContent.includes(envVarName)) {
        envContent += `${envVarName}=${secretValue}\n`;
        envExampleContent += `${envVarName}=your_secret_here\n`;
      }
    }
  }

  if (secretsToMigrate.length > 0) {
    fs.writeFileSync(envPath, envContent);
    fs.writeFileSync(envExamplePath, envExampleContent);
    logger.success('.env and .env.example updated!');
    
    if (fixMode === 'auto') {
      logger.info('Applying Auto-fix to source code...');
      await applyAutoFixes(repoPath, secretsToMigrate);
    } else {
      logger.info('\nManual Action Required:');
      logger.info('Please replace the secrets in your code with environment variable calls:');
      logger.info('- Flutter: String.fromEnvironment(\'VAR_NAME\')');
      logger.info('- iOS: Use xcconfig or ProcessInfo.processInfo.environment[\'VAR_NAME\']');
      logger.info('- Android: Use BuildConfig.VAR_NAME');
    }
  }
}

async function applyAutoFixes(repoPath, secrets) {
  // Group by file to avoid multiple reads/writes
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
        // Flutter auto-fix
        replacement = match.replace(/["'].*?["']/, `String.fromEnvironment('${envVarName}')`);
      } else if (ext === '.kt' || ext === '.java') {
        // Android auto-fix
        replacement = match.replace(/["'].*?["']/, `BuildConfig.${envVarName}`);
      } else if (ext === '.swift') {
        // iOS auto-fix
        replacement = match.replace(/["'].*?["']/, `ProcessInfo.processInfo.environment["${envVarName}"] ?? ""`);
      } else {
        // Generic fallback
        replacement = match.replace(/["'].*?["']/, `process.env.${envVarName}`);
      }

      content = content.replace(match, replacement);
    }

    fs.writeFileSync(absPath, content);
    logger.success(`Updated ${relPath}`);
  }
}
