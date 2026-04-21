import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import logger from '../utils/logger.js';

/**
 * Simple .env parser
 */
function parseEnv(content) {
  const env = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  }
  return env;
}

/**
 * Rollback all protection changes made by blinder blind.
 * - If .blinder_protect.json exists: restore accessors → hardcoded secrets in source
 * - Clean up .env, .env.example, .blinder_protect.json, blinder_reports/
 */
export async function rollbackSecrets(repoPath, options = {}) {
  const metadataPath = path.join(repoPath, '.blinder_protect.json');
  const envPath = path.join(repoPath, '.env');
  const envExamplePath = path.join(repoPath, '.env.example');
  const reportsDir = path.join(repoPath, 'blinder_reports');

  logger.header('Blinder - Rollback');

  // ── Phase 1: Restore source code (if metadata exists) ──
  let codeRestored = false;

  if (fs.existsSync(metadataPath) && fs.existsSync(envPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const envVars = parseEnv(fs.readFileSync(envPath, 'utf8'));
    const { migrations } = metadata;

    logger.info(`Protected at: ${metadata.createdAt}`);
    logger.info(`Found ${migrations.length} migration(s) to rollback.`);
    logger.divider();

    let restoreCount = 0;
    let skipCount = 0;

    migrations.sort((a, b) => {
      const targetA = a.injectedText || a.accessor;
      const targetB = b.injectedText || b.accessor;
      return targetB.length - targetA.length;
    });

    for (const mig of migrations) {
      const { file, envVarName, accessor } = mig;
      const absPath = path.join(repoPath, file);

      if (!fs.existsSync(absPath)) {
        logger.warn(`File not found, skipping: ${file}`);
        skipCount++;
        continue;
      }

      const secretValue = envVars[envVarName];
      if (secretValue === undefined) {
        logger.warn(`Secret "${envVarName}" not in .env, skipping: ${file}`);
        skipCount++;
        continue;
      }

      let content = fs.readFileSync(absPath, 'utf8');
      const targetToRemove = mig.injectedText || accessor;
      if (content.includes(targetToRemove)) {
        // Use replacedText if recorded, otherwise fallback to old double-quote behavior
        const restoredValue = mig.replacedText !== undefined ? mig.replacedText : `"${secretValue}"`;
        content = content.split(targetToRemove).join(restoredValue);

        if (!options.dryRun) {
          fs.writeFileSync(absPath, content);
        }
        logger.success(`Restored: ${file} (${envVarName})`);
        restoreCount++;
      } else {
        logger.warn(`Accessor not found in ${file} — already rolled back?`);
        skipCount++;
      }
    }

    logger.divider();
    logger.success(`Source code restored: ${restoreCount} changes applied.`);
    if (skipCount > 0) logger.warn(`${skipCount} skipped.`);
    codeRestored = true;
  } else if (fs.existsSync(metadataPath)) {
    logger.warn('.env not found. Source code restoration skipped.');
  } else {
    logger.info('No protection metadata found. Skipping source code restoration.');
  }

  // ── Phase 2: Clean up generated files ──
  const filesToClean = [];
  if (fs.existsSync(metadataPath)) filesToClean.push({ path: metadataPath, label: '.blinder_protect.json' });
  if (fs.existsSync(envPath)) filesToClean.push({ path: envPath, label: '.env' });
  if (fs.existsSync(envExamplePath)) filesToClean.push({ path: envExamplePath, label: '.env.example' });
  if (fs.existsSync(reportsDir)) filesToClean.push({ path: reportsDir, label: 'blinder_reports/', isDir: true });

  if (filesToClean.length === 0) {
    logger.info('Nothing to clean up. Project is already in original state.');
    return;
  }

  logger.info(`\n📋 Files to clean up:`);
  filesToClean.forEach(f => logger.info(`  • ${f.label}`));

  let confirmCleanup = options.yes;
  if (!confirmCleanup) {
    const response = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmCleanup',
      message: 'Delete these files to fully rollback?',
      default: true
    }]);
    confirmCleanup = response.confirmCleanup;
  }

  if (!confirmCleanup) {
    logger.info('Cleanup cancelled.');
    return;
  }

  if (!options.dryRun) {
    for (const f of filesToClean) {
      if (f.isDir) {
        fs.rmSync(f.path, { recursive: true, force: true });
      } else {
        fs.unlinkSync(f.path);
      }
      logger.success(`Deleted: ${f.label}`);
    }
  } else {
    logger.info('[Dry-Run] No files were actually deleted.');
  }

  logger.header('Rollback Complete');
  logger.success('Project restored to pre-protection state.');
}
