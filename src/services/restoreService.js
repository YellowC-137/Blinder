import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * getAllFilesRecursive
 */
export function getAllFilesRecursive(dirPath, arrayOfFiles = []) {
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
 * repairMissingImports
 */
export function repairMissingImports(fileName, originalContent, newContent) {
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
    const id = imp.identifier.split('.').pop();
    const usageRegex = new RegExp(`\\b${id}\\b`);
    if (usageRegex.test(newContentString)) {
      toRestore.push(imp.full);
    }
  }

  if (toRestore.length === 0) return { content: newContent, fixed: 0, details: [] };

  let insertIndex = -1;
  for (let i = newLines.length - 1; i >= 0; i--) {
    if (info.importRegex.test(newLines[i])) {
      insertIndex = i + 1;
      break;
    }
  }

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
      return { importRegex: /^import\s+([\w\.]+);?/ };
    case '.swift':
      return { importRegex: /^import\s+([\w\s]+)/ };
    case '.dart':
      return { importRegex: /^import\s+['"]([^'"]+)['"]/ };
    case '.m':
    case '.h':
    case '.mm':
      return { importRegex: /^#import\s+["<]([^">]+)[">]/ };
    default:
      return null;
  }
}

/**
 * hasBeenModifiedByAI
 */
export function hasBeenModifiedByAI(relPath, maskedContent, originalContent, mapData) {
  let remasked = originalContent;
  const sortedMappings = Object.entries(mapData.mappings)
    .sort((a, b) => b[1].originalValue.length - a[1].originalValue.length);
    
  for (const [varName, info] of sortedMappings) {
    if (info.files.includes(relPath)) {
      remasked = remasked.split(info.originalValue).join(info.redactedTag);
    }
  }
  return remasked !== maskedContent;
}

/**
 * detectChanges
 */
export function detectChanges(maskDir, repoPath, mapData, options = {}) {
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

  for (const f of filteredCurrent) {
    if (!originalSet.has(f)) changes.added.push(f);
  }

  for (const f of filteredAll) {
    if (!currentSet.has(f)) changes.deleted.push(f);
  }

  for (const f of filteredAll) {
    if (!currentSet.has(f)) continue;

    const maskedPath = path.join(maskDir, f);
    const originalPath = path.join(repoPath, f);

    if (!fs.existsSync(originalPath)) continue;

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
 * findMaskedDirectory
 */
export function findMaskedDirectory(repoPath) {
  const projectName = path.basename(repoPath);
  const conventionDir = path.join(repoPath, `maskedProject_${projectName}`);
  if (fs.existsSync(path.join(conventionDir, '.blinder_map.json'))) return conventionDir;

  const legacyDir = path.join(repoPath, '.blinder_masked');
  if (fs.existsSync(path.join(legacyDir, '.blinder_map.json'))) return legacyDir;

  try {
    const entries = fs.readdirSync(repoPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(repoPath, entry.name, '.blinder_map.json');
        if (fs.existsSync(candidate)) return path.join(repoPath, entry.name);
      }
    }
  } catch { /* ignore */ }
  return null;
}
