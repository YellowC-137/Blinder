import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import logger from '../utils/logger.js';
import { performRollback, cleanGitignore } from '../services/rollbackService.js';

export async function rollbackSecrets(repoPath, options = {}) {
  const metadataPath = path.join(repoPath, '.blinder_protect.json');
  const envPath = path.join(repoPath, '.env');
  const envExamplePath = path.join(repoPath, '.env.example');
  const reportsDir = path.join(repoPath, 'blinder_reports');

  logger.header('Blinder - Rollback');

  const report = await performRollback(repoPath, options);

  if (report.codeRestored) {
    logger.success(`Source code restored: ${report.restoreCount} changes applied.`);
    if (report.skipCount > 0) logger.warn(`${report.skipCount} skipped.`);
  }

  report.bridgeResults.forEach(res => {
    if (res.success) logger.success(`Removed bridge for ${res.name}`);
    else logger.error(`Failed to teardown bridge for ${res.name}: ${res.error}`);
  });

  const filesToClean = [];
  if (fs.existsSync(metadataPath)) filesToClean.push({ path: metadataPath, label: '.blinder_protect.json' });
  if (fs.existsSync(envPath)) filesToClean.push({ path: envPath, label: '.env' });
  if (fs.existsSync(envExamplePath)) filesToClean.push({ path: envExamplePath, label: '.env.example' });
  if (fs.existsSync(reportsDir)) filesToClean.push({ path: reportsDir, label: 'blinder_reports/', isDir: true });

  if (filesToClean.length === 0 && !report.codeRestored) {
    logger.info('Nothing to clean up. Project is already in original state.');
    return;
  }

  if (filesToClean.length > 0) {
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

    if (confirmCleanup && !options.dryRun) {
      for (const f of filesToClean) {
        if (f.isDir) fs.rmSync(f.path, { recursive: true, force: true });
        else fs.unlinkSync(f.path);
        logger.success(`Deleted: ${f.label}`);
      }

      if (cleanGitignore(repoPath)) {
        logger.success('Restored: .gitignore (Removed Blinder sections)');
      }
    }
  }

  logger.header('Rollback Complete');
}
