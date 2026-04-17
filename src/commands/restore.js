import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
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
 * Detects if a file was modified by AI by re-sanitizing original content 
 * and comparing with current sanitized version.
 */
function hasBeenModifiedByAI(relPath, sanitizedContent, originalContent, mapData) {
  let resanitized = originalContent;
  
  // Apply all mappings to the original content to recreate the "initial sanitized" state
  for (const [varName, info] of Object.entries(mapData.mappings)) {
    if (info.files.includes(relPath)) {
      // Use split/join for global replacement
      resanitized = resanitized.split(info.originalValue).join(info.redactedTag);
    }
  }
  
  return resanitized !== sanitizedContent;
}

/**
 * Detects modified, added, and deleted files.
 */
function detectChanges(sanitizeDir, repoPath, mapData) {
  const changes = { modified: [], added: [], deleted: [], unchanged: 0 };
  const { allFiles } = mapData;

  const currentFiles = getAllFilesRecursive(sanitizeDir)
    .map(f => path.relative(sanitizeDir, f))
    .filter(f => f !== '.blinder_map.json');

  const originalSet = new Set(allFiles);
  const currentSet = new Set(currentFiles);

  // Added files
  for (const f of currentFiles) {
    if (!originalSet.has(f)) {
      changes.added.push(f);
    }
  }

  // Deleted files
  for (const f of allFiles) {
    if (!currentSet.has(f)) {
      changes.deleted.push(f);
    }
  }

  // Modified files
  for (const f of allFiles) {
    if (!currentSet.has(f)) continue;

    const sanitizedPath = path.join(sanitizeDir, f);
    const originalPath = path.join(repoPath, f);

    if (!fs.existsSync(originalPath)) {
      // Original doesn't exist? Treat as added or ignore
      continue;
    }

    const sanitizedContent = fs.readFileSync(sanitizedPath, 'utf8');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    if (hasBeenModifiedByAI(f, sanitizedContent, originalContent, mapData)) {
      changes.modified.push(f);
    } else {
      changes.unchanged++;
    }
  }

  return changes;
}

/**
 * Restores AI-modified files back to the original project.
 */
export async function restoreFromSanitized(repoPath, options = {}) {
  const sanitizeDir = path.join(repoPath, options.sanitizeOutput || '.blinder_sanitized');
  const mapPath = path.join(sanitizeDir, '.blinder_map.json');

  if (!fs.existsSync(mapPath)) {
    logger.error('Mapping file (.blinder_map.json) not found in sanitized directory.');
    logger.info('Please run "blinder sanitize" first.');
    return;
  }

  logger.header('Blinder - Restore AI Changes');
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  logger.info(`Source: ${sanitizeDir}`);
  logger.info(`Sanitized at: ${mapData.createdAt}`);

  const spinner = logger.info('Analyzing changes...');
  const changes = detectChanges(sanitizeDir, repoPath, mapData);

  logger.divider();
  logger.info('📋 AI 작업 결과 요약');
  if (changes.modified.length > 0) changes.modified.forEach(f => logger.success(`  ✏️  Modified: ${f}`));
  if (changes.added.length > 0) changes.added.forEach(f => logger.success(`  ➕ Added:    ${f}`));
  if (changes.deleted.length > 0) changes.deleted.forEach(f => logger.warn(`  🗑️  Deleted:  ${f}`));
  logger.info(`  📊 Total: ${changes.modified.length} modified / ${changes.added.length} added / ${changes.deleted.length} deleted (${changes.unchanged} unchanged)`);

  // Integrity Check
  const integrityIssues = [];
  for (const f of changes.modified) {
    const content = fs.readFileSync(path.join(sanitizeDir, f), 'utf8');
    for (const [varName, info] of Object.entries(mapData.mappings)) {
      if (info.files.includes(f) && !content.includes(info.redactedTag)) {
        integrityIssues.push(`${f}: <REDACTED:${varName}> tag was missing or modified.`);
      }
    }
  }

  if (integrityIssues.length > 0) {
    logger.warn(`\n⚠️  Integrity Check Failed (${integrityIssues.length} issues):`);
    integrityIssues.forEach(m => logger.error(`  ${m}`));
    const { force } = await inquirer.prompt([{
      type: 'confirm',
      name: 'force',
      message: 'Some redaction tags are missing. Restoration might leave raw placeholders or break code. Proceed anyway?',
      default: false
    }]);
    if (!force) return;
  } else {
    logger.success('\n✔ REDACTED 태그 무결성: 모든 태그 정상');
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Apply these changes to the original project?',
    default: true
  }]);

  if (!confirm) return;

  // Apply changes
  for (const f of changes.modified) {
    const srcPath = path.join(sanitizeDir, f);
    const destPath = path.join(repoPath, f);
    let content = fs.readFileSync(srcPath, 'utf8');

    // Restore secrets
    for (const [varName, info] of Object.entries(mapData.mappings)) {
      content = content.split(info.redactedTag).join(info.originalValue);
    }

    if (!options.dryRun) {
      fs.writeFileSync(destPath, content);
    }
    logger.success(`✔ Restored: ${f}`);
  }

  for (const f of changes.added) {
    const srcPath = path.join(sanitizeDir, f);
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

    const { shouldDelete } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldDelete',
      message: `AI deleted "${f}". Delete from original project too?`,
      default: false
    }]);

    if (shouldDelete && !options.dryRun) {
      fs.unlinkSync(destPath);
      logger.warn(`✔ Deleted: ${f}`);
    }
  }

  logger.header('Restore Complete');
  const { cleanup } = await inquirer.prompt([{
    type: 'confirm',
    name: 'cleanup',
    message: 'Delete the sanitized folder (.blinder_sanitized)?',
    default: true
  }]);

  if (cleanup && !options.dryRun) {
    fs.rmSync(sanitizeDir, { recursive: true, force: true });
    logger.success('Cleaned up sanitized folder.');
  }
}
