import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as Diff from 'diff';
import logger from '../utils/logger.js';
import { 
  findMaskedDirectory, 
  detectChanges, 
  repairMissingImports 
} from '../services/restoreService.js';

export async function restoreFromMasked(repoPath, options = {}) {
  let maskDir = (options.maskOutput && options.maskOutput !== '.blinder_masked')
    ? path.join(repoPath, options.maskOutput)
    : findMaskedDirectory(repoPath);

  if (!maskDir) {
    logger.error('Mapping file (.blinder_map.json) not found in any directory.');
    logger.info('Please run "blinder mask" first, or specify the directory with -o.');
    return;
  }

  const mapPath = path.join(maskDir, '.blinder_map.json');
  if (!fs.existsSync(mapPath)) {
    logger.error(`Mapping file (.blinder_map.json) not found in: ${maskDir}`);
    return;
  }

  logger.header('Blinder - Restore AI Changes');
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  logger.info(`Source: ${maskDir}`);
  logger.info(`Masked at: ${mapData.createdAt}`);
  if (options.paths && options.paths.length > 0) {
    logger.info(`Target Paths: ${options.paths.join(', ')}`);
  }

  const spinner = logger.info('Analyzing changes...');
  const changes = detectChanges(maskDir, repoPath, mapData, options);

  logger.divider();
  logger.info('📋 AI-Agent Work Summary:');
  if (changes.modified.length > 0) changes.modified.forEach(f => logger.success(`  ✏️  Modified: ${f}`));
  if (changes.added.length > 0) changes.added.forEach(f => logger.success(`  ➕ Added:    ${f}`));
  if (changes.deleted.length > 0) logger.warn(`  🗑️  Deleted:  ${changes.deleted.length} files`);
  logger.info(`  📊 Total: ${changes.modified.length} modified / ${changes.added.length} added / ${changes.deleted.length} deleted (${changes.unchanged} unchanged)`);

  // Integrity Check
  const missingTags = [];
  for (const f of changes.modified) {
    const content = fs.readFileSync(path.join(maskDir, f), 'utf8');
    for (const [varName, info] of Object.entries(mapData.mappings)) {
      if (info.files.includes(f) && !content.includes(info.redactedTag)) {
        missingTags.push({ file: f, tag: info.redactedTag });
      }
    }
  }

  if (missingTags.length > 0) {
    logger.warn(`\n⚠️  Missing Redaction Tags Detected (${missingTags.length} instances):`);
    logger.info('These tags were present before, but AI has modified or removed them.');
    
    let force = options.auto || options.yes;
    if (!force) {
      const prompt = await inquirer.prompt([{
        type: 'confirm',
        name: 'force',
        message: 'Proceed with restoration anyway?',
        default: true
      }]);
      force = prompt.force;
    }
    if (!force) return;
  } else {
    logger.success('\n✔ Tag Integrity Check: All BLINDER tags are present.');
  }

  const plannedModifications = [];
  for (const f of changes.modified) {
    const srcPath = path.join(maskDir, f);
    let content = fs.readFileSync(srcPath, 'utf8');
    const sortedMappings = Object.entries(mapData.mappings)
      .sort((a, b) => b[1].redactedTag.length - a[1].redactedTag.length);
      
    for (const [varName, info] of sortedMappings) {
      content = content.split(info.redactedTag).join(info.originalValue);
    }

    const originalPath = path.join(repoPath, f);
    if (fs.existsSync(originalPath)) {
      const originalContent = fs.readFileSync(originalPath, 'utf8');
      const repaired = repairMissingImports(f, originalContent, content);
      if (repaired.fixed > 0) {
        content = repaired.content;
        logger.warn(`  🔧 Auto-repaired ${repaired.fixed} missing import(s) in: ${f}`);
      }
    }
    plannedModifications.push({ file: f, newContent: content });
  }

  if (options.diff && plannedModifications.length > 0) {
    showDiffsPreview(repoPath, plannedModifications);
  }

  if (changes.modified.length === 0 && changes.added.length === 0 && changes.deleted.length === 0) {
    logger.info('No files to restore or all requested paths are unchanged.');
    return;
  }

  let confirm = options.auto || options.yes;
  if (!confirm) {
    const prompt = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Apply these changes to your root project?',
      default: true
    }]);
    confirm = prompt.confirm;
  }

  if (!confirm) return;

  // Apply modifications
  for (const mod of plannedModifications) {
    if (!options.dryRun) fs.writeFileSync(path.join(repoPath, mod.file), mod.newContent);
    logger.success(`✔ Restored: ${mod.file}`);
  }

  // Apply additions
  for (const f of changes.added) {
    const srcPath = path.join(maskDir, f);
    const destPath = path.join(repoPath, f);
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    logger.success(`✔ Added: ${f}`);
  }

  // Handle deletions
  for (const f of changes.deleted) {
    const destPath = path.join(repoPath, f);
    if (!fs.existsSync(destPath)) continue;

    let shouldDelete = options.auto || options.yes;
    if (!shouldDelete) {
      const prompt = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldDelete',
        message: `File "${f}" was deleted in the masked environment. Delete from original project?`,
        default: false
      }]);
      shouldDelete = prompt.shouldDelete;
    }

    if (shouldDelete && !options.dryRun) {
      fs.unlinkSync(destPath);
      logger.warn(`✔ Deleted: ${f}`);
    }
  }

  logger.header('Restore Complete');
  
  let cleanup = options.auto || options.yes;
  if (!cleanup) {
    const prompt = await inquirer.prompt([{
      type: 'confirm',
      name: 'cleanup',
      message: 'Clean up the temporary masked directory?',
      default: true
    }]);
    cleanup = prompt.cleanup;
  }

  if (cleanup && !options.dryRun) {
    fs.rmSync(maskDir, { recursive: true, force: true });
    logger.success('Cleaned up masked folder.');
  }
}

function showDiffsPreview(repoPath, plannedModifications) {
  logger.header('Diff Preview');
  for (const mod of plannedModifications) {
    const originalPath = path.join(repoPath, mod.file);
    const originalContent = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf8') : '';
    const diff = Diff.diffLines(originalContent, mod.newContent);
    
    console.log(chalk.cyan.bold(`\n--- a/${mod.file}`));
    console.log(chalk.cyan.bold(`+++ b/${mod.file}`));
    
    diff.forEach((part) => {
      const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.gray;
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';
      const lines = part.value.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        console.log(color(`${prefix} ${lines[i]}`));
      }
    });
  }
  logger.divider();
}
