import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as Diff from 'diff';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { 
  findMaskedDirectory, 
  detectChanges, 
  repairMissingImports 
} from '../services/restoreService.js';
import type { MaskingMap } from '../types/index.js';

interface RestoreOptions {
  maskOutput?: string;
  auto?: boolean;
  yes?: boolean;
  diff?: boolean;
  dryRun?: boolean;
  paths?: string[];
}

interface PlannedModification {
  file: string;
  newContent: string;
}

export async function restoreFromMasked(repoPath: string, options: RestoreOptions = {}): Promise<void> {
  let maskDir: string | null = (options.maskOutput && options.maskOutput !== '.blinder_masked')
    ? path.join(repoPath, options.maskOutput)
    : findMaskedDirectory(repoPath);

  if (!maskDir) {
    logger.error(t('restore_no_map'));
    logger.info(t('restore_run_mask_first'));
    return;
  }

  const mapPath: string = path.join(maskDir, '.blinder_map.json');
  if (!fs.existsSync(mapPath)) {
    logger.error(t('restore_no_map_in_dir', { dir: maskDir }));
    return;
  }

  logger.header(t('restore_header'));
  const mapData: MaskingMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  logger.info(t('restore_source', { dir: maskDir }));
  logger.info(t('restore_masked_at', { date: mapData.createdAt }));
  if (options.paths && options.paths.length > 0) {
    logger.info(t('restore_target_paths', { paths: options.paths.join(', ') }));
  }

  const spinner: void = logger.info(t('restore_analyzing'));
  const changes = detectChanges(maskDir, repoPath, mapData, options);

  logger.divider();
  logger.info(t('restore_summary_title'));
  if (changes.modified.length > 0) changes.modified.forEach((f: string) => logger.success(t('restore_modified', { file: f })));
  if (changes.added.length > 0) changes.added.forEach((f: string) => logger.success(t('restore_added', { file: f })));
  if (changes.deleted.length > 0) logger.warn(t('restore_deleted_count', { count: changes.deleted.length }));
  logger.info(t('restore_total_stats', { mod: changes.modified.length, add: changes.added.length, del: changes.deleted.length, unchanged: changes.unchanged }));

  // Integrity Check
  const missingTags: Array<{ file: string; tag: string }> = [];
  for (const f of changes.modified) {
    const content: string = fs.readFileSync(path.join(maskDir, f), 'utf8');
    for (const [varName, info] of Object.entries(mapData.mappings)) {
      if (info.files.includes(f) && !content.includes(info.redactedTag)) {
        missingTags.push({ file: f, tag: info.redactedTag });
      }
    }
  }

  if (missingTags.length > 0) {
    logger.warn(t('restore_missing_tags_title', { count: missingTags.length }));
    logger.info(t('restore_missing_tags_desc'));
    
    let force: boolean = options.auto || options.yes || false;
    if (!force) {
      const prompt = await inquirer.prompt<{ force: boolean }>([{
        type: 'confirm',
        name: 'force',
        message: t('restore_prompt_proceed'),
        default: true
      }]);
      force = prompt.force;
    }
    if (!force) return;
  } else {
    logger.success(t('restore_integrity_check_ok'));
  }

  const plannedModifications: PlannedModification[] = [];
  for (const f of changes.modified) {
    const srcPath: string = path.join(maskDir, f);
    let content: string = fs.readFileSync(srcPath, 'utf8');
    const sortedMappings = Object.entries(mapData.mappings)
      .sort((a, b) => b[1].redactedTag.length - a[1].redactedTag.length);
      
    for (const [varName, info] of sortedMappings) {
      content = content.split(info.redactedTag).join(info.originalValue);
    }

    const originalPath: string = path.join(repoPath, f);
    if (fs.existsSync(originalPath)) {
      const originalContent: string = fs.readFileSync(originalPath, 'utf8');
      const repaired = repairMissingImports(f, originalContent, content);
      if (repaired.fixed > 0) {
        content = repaired.content;
        logger.warn(t('restore_auto_repaired', { count: repaired.fixed, file: f }));
      }
    }
    plannedModifications.push({ file: f, newContent: content });
  }

  if (options.diff && plannedModifications.length > 0) {
    showDiffsPreview(repoPath, plannedModifications);
  }

  if (changes.modified.length === 0 && changes.added.length === 0 && changes.deleted.length === 0) {
    logger.info(t('restore_nothing'));
    return;
  }

  let confirm: boolean = options.auto || options.yes || false;
  if (!confirm) {
    const prompt = await inquirer.prompt<{ confirm: boolean }>([{
      type: 'confirm',
      name: 'confirm',
      message: t('restore_prompt_apply'),
      default: true
    }]);
    confirm = prompt.confirm;
  }

  if (!confirm) return;

  // Apply modifications
  for (const mod of plannedModifications) {
    try {
      if (!options.dryRun) fs.writeFileSync(path.join(repoPath, mod.file), mod.newContent);
      logger.success(t('restore_restored_file', { file: mod.file }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(t('restore_restore_failed', { file: mod.file, msg: message }));
    }
  }

  // Apply additions
  for (const f of changes.added) {
    const srcPath: string = path.join(maskDir, f);
    const destPath: string = path.join(repoPath, f);
    try {
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
      logger.success(t('restore_added_file', { file: f }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(t('restore_add_failed', { file: f, msg: message }));
    }
  }

  // Handle deletions
  for (const f of changes.deleted) {
    const destPath: string = path.join(repoPath, f);
    if (!fs.existsSync(destPath)) continue;

    let shouldDelete: boolean = options.auto || options.yes || false;
    if (!shouldDelete) {
      const prompt = await inquirer.prompt<{ shouldDelete: boolean }>([{
        type: 'confirm',
        name: 'shouldDelete',
        message: t('restore_prompt_delete', { file: f }),
        default: false
      }]);
      shouldDelete = prompt.shouldDelete;
    }

    if (shouldDelete && !options.dryRun) {
      try {
        fs.unlinkSync(destPath);
        logger.warn(t('restore_deleted_file', { file: f }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(t('restore_delete_failed', { file: f, msg: message }));
      }
    }
  }

  logger.header(t('restore_complete'));
  
  let cleanup: boolean = options.auto || options.yes || false;
  if (!cleanup) {
    const prompt = await inquirer.prompt<{ cleanup: boolean }>([{
      type: 'confirm',
      name: 'cleanup',
      message: t('restore_prompt_cleanup'),
      default: true
    }]);
    cleanup = prompt.cleanup;
  }

  if (cleanup && !options.dryRun) {
    try {
      fs.rmSync(maskDir, { recursive: true, force: true });
      logger.success(t('restore_cleanup_success'));
    } catch (err: unknown) {
      // Cleanup is best-effort. ENOTEMPTY (e.g. macOS Finder created
      // .DS_Store after our walk) shouldn't fail the whole restore.
      const nodeErr = err as NodeJS.ErrnoException;
      logger.warn(t('restore_cleanup_partial', { errCode: nodeErr.code || nodeErr.name, errMsg: nodeErr.message, dir: maskDir as string }));
    }
  }
}

function showDiffsPreview(repoPath: string, plannedModifications: PlannedModification[]): void {
  logger.header(t('restore_diff_preview'));
  for (const mod of plannedModifications) {
    const originalPath: string = path.join(repoPath, mod.file);
    const originalContent: string = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf8') : '';
    const diff = Diff.diffLines(originalContent, mod.newContent);
    
    console.log(chalk.cyan.bold(`\n--- a/${mod.file}`));
    console.log(chalk.cyan.bold(`+++ b/${mod.file}`));
    
    diff.forEach((part: Diff.Change) => {
      const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.gray;
      const prefix: string = part.added ? '+' : part.removed ? '-' : ' ';
      const lines: string[] = part.value.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        console.log(color(`${prefix} ${lines[i]}`));
      }
    });
  }
  logger.divider();
}
