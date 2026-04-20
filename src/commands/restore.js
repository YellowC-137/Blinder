import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as Diff from 'diff';
import logger from '../utils/logger.js';

/**
 * Gets all files in a directory recursively.
 */
function getAllFilesRecursive(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFilesRecursive(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

/**
 * Detects if a file was modified by AI by re-masking original content 
 * and comparing with current masked version.
 */
function hasBeenModifiedByAI(relPath, maskedContent, originalContent, mapData) {
  let remasked = originalContent;
  
  // Apply all mappings to the original content to recreate the "initial masked" state
  for (const [varName, info] of Object.entries(mapData.mappings)) {
    if (info.files.includes(relPath)) {
      // Use split/join for global replacement
      remasked = remasked.split(info.originalValue).join(info.redactedTag);
    }
  }
  
  return remasked !== maskedContent;
}

/**
 * Detects modified, added, and deleted files.
 */
function detectChanges(maskDir, repoPath, mapData, options = {}) {
  const changes = { modified: [], added: [], deleted: [], unchanged: 0 };
  const { allFiles } = mapData;

  const currentFiles = getAllFilesRecursive(maskDir)
    .map(f => path.relative(maskDir, f))
    .filter(f => f !== '.blinder_map.json');

  const pathPrefixes = options.paths && options.paths.length > 0 ? options.paths : [];
  const isTarget = (f) => pathPrefixes.length === 0 || pathPrefixes.some(p => f.startsWith(p));

  const filteredAll = allFiles.filter(isTarget);
  const filteredCurrent = currentFiles.filter(isTarget);

  const originalSet = new Set(filteredAll);
  const currentSet = new Set(filteredCurrent);

  // Added files
  for (const f of filteredCurrent) {
    if (!originalSet.has(f)) {
      changes.added.push(f);
    }
  }

  // Deleted files
  for (const f of filteredAll) {
    if (!currentSet.has(f)) {
      changes.deleted.push(f);
    }
  }

  // Modified files
  for (const f of filteredAll) {
    if (!currentSet.has(f)) continue;

    const maskedPath = path.join(maskDir, f);
    const originalPath = path.join(repoPath, f);

    if (!fs.existsSync(originalPath)) {
      // Original doesn't exist? Treat as added or ignore
      continue;
    }

    const maskedBuf = fs.readFileSync(maskedPath);
    const currentHash = crypto.createHash('sha256').update(maskedBuf).digest('hex');
    const savedHash = mapData.fileHashes ? mapData.fileHashes[f] : null;

    if (savedHash && currentHash === savedHash) {
      changes.unchanged++;
      continue;
    }

    const maskedContent = maskedBuf.toString('utf8');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    if (hasBeenModifiedByAI(f, maskedContent, originalContent, mapData)) {
      changes.modified.push(f);
    } else {
      changes.unchanged++;
    }
  }

  return changes;
}

/**
 * Restores AI-modified files back to the original project from the masked directory.
 */
export async function restoreFromMasked(repoPath, options = {}) {
  const maskDir = path.join(repoPath, options.maskOutput || '.blinder_masked');
  const mapPath = path.join(maskDir, '.blinder_map.json');

  if (!fs.existsSync(mapPath)) {
    logger.error('Mapping file (.blinder_map.json) not found in masked directory.');
    logger.info('Please run "blinder mask" first.');
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
  const integrityIssues = [];
  for (const f of changes.modified) {
    const content = fs.readFileSync(path.join(maskDir, f), 'utf8');
    for (const [varName, info] of Object.entries(mapData.mappings)) {
      if (info.files.includes(f) && !content.includes(info.redactedTag)) {
        integrityIssues.push(`${f}: <REDACTED:${varName}> tag was missing or modified.`);
      }
    }
  }

  if (integrityIssues.length > 0) {
    logger.warn(`\n⚠️  Integrity Check Failed (${integrityIssues.length} issues):`);
    integrityIssues.forEach(m => logger.error(`  ${m}`));
    
    let force = options.auto;
    if (!force) {
      const prompt = await inquirer.prompt([{
        type: 'confirm',
        name: 'force',
        message: 'Some redaction tags are missing. Restoration might leave raw placeholders or break code. Proceed anyway?',
        default: false
      }]);
      force = prompt.force;
    }
    if (!force) return;
  } else {
    logger.success('\n✔ Tag Integrity Check: All REDACTED tags are present.');
  }

  // Calculate restored contents early
  const plannedModifications = [];
  for (const f of changes.modified) {
    const srcPath = path.join(maskDir, f);
    let content = fs.readFileSync(srcPath, 'utf8');
    // Restore secrets
    for (const [varName, info] of Object.entries(mapData.mappings)) {
      content = content.split(info.redactedTag).join(info.originalValue);
    }
    plannedModifications.push({ file: f, newContent: content });
  }

  // Display Diffs Preview if requested
  if (options.diff && plannedModifications.length > 0) {
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
        // Split text to line by line with prefix
        const lines = part.value.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          console.log(color(`${prefix} ${lines[i]}`));
        }
      });
    }
    logger.divider();
  }

  if (changes.modified.length === 0 && changes.added.length === 0 && changes.deleted.length === 0) {
    logger.info('No files to restore or all requested paths are unchanged.');
    return;
  }

  let confirm = options.auto;
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

  // Apply changes
  for (const mod of plannedModifications) {
    if (!options.dryRun) {
      fs.writeFileSync(path.join(repoPath, mod.file), mod.newContent);
    }
    logger.success(`✔ Restored: ${mod.file}`);
  }

  for (const f of changes.added) {
    const srcPath = path.join(maskDir, f);
    const destPath = path.join(repoPath, f);
    
    if (!options.dryRun) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    logger.success(`✔ Added: ${f}`);
  }

  for (const f of changes.deleted) {
    const destPath = path.join(repoPath, f);
    if (!fs.existsSync(destPath)) continue;

    let shouldDelete = options.auto;
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
  
  let cleanup = options.auto;
  if (!cleanup) {
    const prompt = await inquirer.prompt([{
      type: 'confirm',
      name: 'cleanup',
      message: 'Clean up the temporary masked directory (.blinder_masked)?',
      default: true
    }]);
    cleanup = prompt.cleanup;
  }

  if (cleanup && !options.dryRun) {
    fs.rmSync(maskDir, { recursive: true, force: true });
    logger.success('Cleaned up masked folder.');
  }
}
