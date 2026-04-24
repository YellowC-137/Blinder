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
 * Extracts imports and detects missing ones that are still needed.
 */
function repairMissingImports(fileName, originalContent, newContent) {
  const ext = path.extname(fileName);
  const info = getLanguageSpecificImportInfo(ext);
  if (!info) return { content: newContent, fixed: 0, details: [] };

  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');
  const newContentString = newContent;

  const originalImports = originalLines
    .filter(line => info.importRegex.test(line))
    .map(line => {
      const match = line.match(info.importRegex);
      return { full: line.trim(), identifier: match[1] || match[0] };
    });

  const currentImports = new Set(newLines.filter(line => info.importRegex.test(line)).map(line => line.trim()));
  const missing = originalImports.filter(imp => !currentImports.has(imp.full));
  
  const toRestore = [];
  for (const imp of missing) {
    // Basic check: is the identifier (e.g. ClassName) still present in the code body?
    // We use a word boundary regex to avoid partial matches
    const id = imp.identifier.split('.').pop(); // Get last part for Java/Kotlin (e.g. Repository)
    const usageRegex = new RegExp(`\\b${id}\\b`);
    
    if (usageRegex.test(newContentString)) {
      toRestore.push(imp.full);
    }
  }

  if (toRestore.length === 0) return { content: newContent, fixed: 0, details: [] };

  // Find a good place to insert (after existing imports or at the top)
  let insertIndex = -1;
  for (let i = newLines.length - 1; i >= 0; i--) {
    if (info.importRegex.test(newLines[i])) {
      insertIndex = i + 1;
      break;
    }
  }

  // If no imports found, find package declaration or just start at top (after comments)
  if (insertIndex === -1) {
    const packageRegex = /^(?:package|module)\s+/;
    for (let i = 0; i < newLines.length; i++) {
      if (packageRegex.test(newLines[i])) {
        insertIndex = i + 1;
        break;
      }
    }
  }
  
  if (insertIndex === -1) insertIndex = 0;

  const resultLines = [...newLines];
  resultLines.splice(insertIndex, 0, ...toRestore);

  return {
    content: resultLines.join('\n'),
    fixed: toRestore.length,
    details: toRestore
  };
}

function getLanguageSpecificImportInfo(ext) {
  switch (ext) {
    case '.kt':
    case '.java':
      return {
        // Matches "import com.foo.Bar" and captures "com.foo.Bar"
        importRegex: /^import\s+([\w\.]+);?/
      };
    case '.swift':
      return {
        // Matches "import UIKit" and captures "UIKit"
        importRegex: /^import\s+([\w\s]+)/
      };
    case '.dart':
      return {
        // Matches "import 'package:...'" and captures the string content
        importRegex: /^import\s+['"]([^'"]+)['"]/
      };
    case '.m':
    case '.h':
    case '.mm':
      return {
        // Matches "#import <Header.h>" or "#import "Header.h""
        importRegex: /^#import\s+["<]([^">]+)[">]/
      };
    default:
      return null;
  }
}

/**
 * Detects if a file was modified by AI by re-masking original content 
 * and comparing with current masked version.
 */
function hasBeenModifiedByAI(relPath, maskedContent, originalContent, mapData) {
  let remasked = originalContent;
  
  // Sort mappings by originalValue length descending to match mask.js masking order
  const sortedMappings = Object.entries(mapData.mappings)
    .sort((a, b) => b[1].originalValue.length - a[1].originalValue.length);
    
  // Apply all mappings to the original content to recreate the "initial masked" state
  for (const [varName, info] of sortedMappings) {
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
/**
 * Auto-detects the masked directory by searching for .blinder_map.json
 * in likely locations within the repo.
 */
function findMaskedDirectory(repoPath) {
  // 1. Check the maskedProject_<name> convention (mask.js default)
  const projectName = path.basename(repoPath);
  const conventionDir = path.join(repoPath, `maskedProject_${projectName}`);
  if (fs.existsSync(path.join(conventionDir, '.blinder_map.json'))) {
    return conventionDir;
  }

  // 2. Check legacy default
  const legacyDir = path.join(repoPath, '.blinder_masked');
  if (fs.existsSync(path.join(legacyDir, '.blinder_map.json'))) {
    return legacyDir;
  }

  // 3. Scan top-level directories for any containing .blinder_map.json
  try {
    const entries = fs.readdirSync(repoPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(repoPath, entry.name, '.blinder_map.json');
        if (fs.existsSync(candidate)) {
          return path.join(repoPath, entry.name);
        }
      }
    }
  } catch { /* ignore */ }

  return null;
}

export async function restoreFromMasked(repoPath, options = {}) {
  let maskDir;

  if (options.maskOutput && options.maskOutput !== '.blinder_masked') {
    // User explicitly specified an output directory
    maskDir = path.join(repoPath, options.maskOutput);
  } else {
    // Auto-detect the masked directory
    maskDir = findMaskedDirectory(repoPath);
  }

  if (!maskDir) {
    logger.error('Mapping file (.blinder_map.json) not found in any directory.');
    logger.info('Please run "blinder mask" first, or specify the directory with -o.');
    return;
  }

  const mapPath = path.join(maskDir, '.blinder_map.json');

  if (!fs.existsSync(mapPath)) {
    logger.error(`Mapping file (.blinder_map.json) not found in: ${maskDir}`);
    logger.info('Please run "blinder mask" first, or specify the correct directory with -o.');
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
    logger.info('This is perfectly NORMAL if the AI intentionally refactored or deleted the code.');
    missingTags.forEach(m => logger.warn(`  - ${m.file}: ${m.tag}`));
    
    let force = options.auto || options.yes;
    if (!force) {
      const prompt = await inquirer.prompt([{
        type: 'confirm',
        name: 'force',
        message: 'Proceed with restoration anyway? (Tags that no longer exist will just be skipped)',
        default: true
      }]);
      force = prompt.force;
    }
    if (!force) return;
  } else {
    logger.success('\n✔ Tag Integrity Check: All BLINDER tags are present.');
  }

  // Calculate restored contents early
  const plannedModifications = [];
  for (const f of changes.modified) {
    const srcPath = path.join(maskDir, f);
    let content = fs.readFileSync(srcPath, 'utf8');
    // Restore secrets
    const sortedMappings = Object.entries(mapData.mappings)
      .sort((a, b) => b[1].redactedTag.length - a[1].redactedTag.length);
      
    for (const [varName, info] of sortedMappings) {
      content = content.split(info.redactedTag).join(info.originalValue);
    }

    // Import Integrity Check: auto-repair missing imports that AI accidentally removed
    const originalPath = path.join(repoPath, f);
    if (fs.existsSync(originalPath)) {
      const originalContent = fs.readFileSync(originalPath, 'utf8');
      const repaired = repairMissingImports(f, originalContent, content);
      if (repaired.fixed > 0) {
        content = repaired.content;
        logger.warn(`  🔧 Auto-repaired ${repaired.fixed} missing import(s) in: ${f}`);
        repaired.details.forEach(d => logger.info(`     + ${d}`));
      }
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
