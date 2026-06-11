import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { MaskingMap } from '../types/index.js';

/**
 * getAllFilesRecursive
 */
export function getAllFilesRecursive(dirPath: string, arrayOfFiles: string[] = []): string[] {
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

interface ImportInfo {
  importRegex: RegExp;
}

interface RepairResult {
  content: string;
  fixed: number;
  details: string[];
}

/**
 * repairMissingImports
 */
export function repairMissingImports(fileName: string, originalContent: string, newContent: string): RepairResult {
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
      return { full: line.trim(), identifier: match![1] || match![0] };
    });

  const currentImports = new Set(newLines.filter(line => info.importRegex.test(line)).map(line => line.trim()));
  const missing = originalImports.filter(imp => !currentImports.has(imp.full));
  
  const toRestore: string[] = [];
  for (const imp of missing) {
    const id = imp.identifier.split('.').pop();
    if (!id) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const usageRegex = new RegExp(`\\b${escaped}\\b`);
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

function getLanguageSpecificImportInfo(ext: string): ImportInfo | null {
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
export function hasBeenModifiedByAI(relPath: string, maskedContent: string, originalContent: string, mapData: MaskingMap): boolean {
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

// OS-generated metadata files that appear in mask dirs after the user opens
// them in Finder/Explorer. Excluded from change detection so they don't show
// up as "Added" by AI.
const OS_METADATA_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', 'ehthumbs.db']);

function isOsMetadata(relPath: string): boolean {
  const base = path.basename(relPath);
  return OS_METADATA_FILES.has(base);
}

interface DetectChangesOptions {
  paths?: string[];
}

interface ChangeReport {
  modified: string[];
  added: string[];
  deleted: string[];
  unchanged: number;
}

/**
 * detectChanges
 */
export function detectChanges(maskDir: string, repoPath: string, mapData: MaskingMap, options: DetectChangesOptions = {}): ChangeReport {
  const changes: ChangeReport = { modified: [], added: [], deleted: [], unchanged: 0 };
  const { allFiles } = mapData;

  const currentFiles = getAllFilesRecursive(maskDir)
    .map(f => path.relative(maskDir, f))
    .filter(f => f !== '.blinder_map.json' && !isOsMetadata(f));

  const pathPrefixes = options.paths && options.paths.length > 0 ? options.paths : [];
  const isTarget = (f: string): boolean => pathPrefixes.length === 0 || pathPrefixes.some(p => f.startsWith(p));

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
export function findMaskedDirectory(repoPath: string): string | null {
  const projectName = path.basename(repoPath);
  const conventionDir = path.join(repoPath, `maskedProject_${projectName}`);

  // New layout: maps live in .blinder_maps/<maskDirName>.json
  const mapsDir = path.join(repoPath, '.blinder_maps');
  try {
    const mapFiles = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));
    // Prefer the convention-named map when several exist
    const conventionMap = `${path.basename(conventionDir)}.json`;
    mapFiles.sort((a, b) => (a === conventionMap ? -1 : 0) - (b === conventionMap ? -1 : 0));
    for (const mf of mapFiles) {
      const dir = path.join(repoPath, mf.slice(0, -'.json'.length));
      if (fs.existsSync(dir)) return dir;
    }
  } catch { /* no .blinder_maps dir — fall through to legacy lookup */ }

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
