import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import logger from '../utils/logger.js';
import { performRollback, cleanGitignore } from '../services/rollbackService.js';
import { t } from '../utils/i18n.js';
import type { RollbackOptions } from '../platforms/types.js';
import type { RollbackReport } from '../types/index.js';

interface FileToClean {
  path: string;
  label: string;
  isDir?: boolean;
}

export async function rollbackSecrets(repoPath: string, options: RollbackOptions = {}): Promise<void> {
  const metadataPath: string = path.join(repoPath, '.blinder_protect.json');
  const envPath: string = path.join(repoPath, '.env');
  const envExamplePath: string = path.join(repoPath, '.env.example');
  const reportsDir: string = path.join(repoPath, 'blinder_reports');

  logger.header(t('rollback_header'));

  const report: RollbackReport = await performRollback(repoPath, options);

  if (report.codeRestored) {
    logger.success(t('rollback_success', { count: report.restoreCount }));
    if (report.skipCount > 0) {
      const r = report.skipReasons || {} as RollbackReport['skipReasons'];
      const parts: string[] = [];
      if (r.alreadyRestored) parts.push(`already restored: ${r.alreadyRestored}`);
      if (r.accessorNotFound) parts.push(`accessor edited: ${r.accessorNotFound}`);
      if (r.secretMissing) parts.push(`missing in .env: ${r.secretMissing}`);
      if (r.fileNotFound) parts.push(`file not found: ${r.fileNotFound}`);
      const detail: string = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      logger.warn(t('rollback_skipped', { count: report.skipCount, detail }));
    }
  }

  report.bridgeResults.forEach((res: { name: string; success: boolean; error?: string }) => {
    if (res.success) logger.success(t('rollback_bridge_success', { name: res.name }));
    else logger.error(t('rollback_bridge_failed', { name: res.name, error: res.error || 'unknown' }));
  });

  const filesToClean: FileToClean[] = [];
  if (fs.existsSync(metadataPath)) filesToClean.push({ path: metadataPath, label: '.blinder_protect.json' });
  if (fs.existsSync(envPath)) filesToClean.push({ path: envPath, label: '.env' });
  if (fs.existsSync(envExamplePath)) filesToClean.push({ path: envExamplePath, label: '.env.example' });
  if (fs.existsSync(reportsDir)) filesToClean.push({ path: reportsDir, label: 'blinder_reports/', isDir: true });

  if (filesToClean.length === 0 && !report.codeRestored) {
    logger.info(t('rollback_nothing'));
    return;
  }

  if (filesToClean.length > 0) {
    logger.info(t('rollback_files_title'));
    filesToClean.forEach((f: FileToClean) => logger.info(`  • ${f.label}`));

    let confirmCleanup: boolean | undefined = options.yes;
    if (!confirmCleanup) {
      const response = await inquirer.prompt<{ confirmCleanup: boolean }>([{
        type: 'confirm',
        name: 'confirmCleanup',
        message: t('rollback_prompt_delete'),
        default: true
      }]);
      confirmCleanup = response.confirmCleanup;
    }

    if (confirmCleanup && !options.dryRun) {
      for (const f of filesToClean) {
        if (f.isDir) fs.rmSync(f.path, { recursive: true, force: true });
        else fs.unlinkSync(f.path);
        logger.success(t('rollback_deleted', { label: f.label }));
      }

      if (cleanGitignore(repoPath)) {
        logger.success(t('rollback_gitignore'));
      }
    }
  }

  logger.header(t('rollback_complete'));
}
