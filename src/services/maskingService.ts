import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import type { MaskingMap, ScanResult, CodeSecretMatch } from '../types/index.js';
import type { MaskOptions } from '../platforms/types.js';

/**
 * performMasking
 * (보안지침 §6: AI 에이전트 전송용 프로젝트 마스킹 복사본 생성 로직)
 */
export async function performMasking(
  repoPath: string,
  allFiles: string[],
  results: ScanResult[],
  maskDir: string,
  options: MaskOptions = {}
): Promise<MaskingMap> {
  const mappingData: MaskingMap = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    projectRoot: repoPath,
    mappings: {},
    fileHashes: {},
    allFiles: []
  };

  const secretsByFile = results.reduce<Record<string, ScanResult[]>>((acc, s) => {
    if (!acc[s.file]) acc[s.file] = [];
    acc[s.file].push(s);
    return acc;
  }, {});

  const dryRun = options.dryRun === true;

  if (!dryRun && !fs.existsSync(maskDir)) {
    fs.mkdirSync(maskDir, { recursive: true });
  }

  for (const relPath of allFiles) {
    // Defensive: a crafted entry must not escape maskDir
    if (path.isAbsolute(relPath) || relPath.split(/[\\/]/).includes('..')) {
      logger.debug(`Skipping unsafe path: ${relPath}`);
      continue;
    }
    const srcPath = path.join(repoPath, relPath);
    const destPath = path.join(maskDir, relPath);

    try {
      if (fs.statSync(srcPath).isDirectory()) continue;
    } catch (err) {
      logger.debug(`Skipping ${relPath}: ${(err as Error).message}`);
      continue;
    }

    const destFolder = path.dirname(destPath);
    if (!dryRun && !fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    try {
      if (secretsByFile[relPath]) {
        let content = fs.readFileSync(srcPath, 'utf8');
        const secrets = secretsByFile[relPath] as CodeSecretMatch[];
        // Stable sort: by match length descending, then envVarName for determinism
        secrets.sort((a, b) => b.match.length - a.match.length || a.envVarName.localeCompare(b.envVarName));

        for (const s of secrets) {
          const mask = `__BLINDER_${s.envVarName}__`;
          // Skip if the match value isn't actually present (likely already
          // masked by a prior pattern with a different envVarName but same
          // match value — registering this file under the unused tag would
          // trigger a false "Missing Redaction Tag" during restore).
          const beforeContent = content;
          content = content.split(s.match).join(mask);
          const replaced = content !== beforeContent;

          if (!mappingData.mappings[s.envVarName]) {
            mappingData.mappings[s.envVarName] = {
              originalValue: s.match,
              redactedTag: mask,
              files: []
            };
          }
          if (replaced && !mappingData.mappings[s.envVarName].files.includes(relPath)) {
            mappingData.mappings[s.envVarName].files.push(relPath);
          }
        }
        if (!dryRun) fs.writeFileSync(destPath, content);
      } else if (!dryRun) {
        fs.copyFileSync(srcPath, destPath);
      }

      // Stream-based hashing to save memory. Skipped in dry-run — destPath
      // is never written, so there is nothing on disk to hash.
      if (!dryRun) {
        mappingData.fileHashes[relPath] = await calculateHash(destPath);
      }
      mappingData.allFiles.push(relPath);
    } catch (err) {
      logger.error(t('masking_file_failed', { file: relPath, msg: (err as Error).message }));
      // Continue with other files even if one fails
    }
  }

  // The map holds every original secret value — keep it OUTSIDE maskDir so
  // sharing the masked directory with an AI agent cannot leak secrets.
  // Dry-run returns the in-memory preview without touching disk.
  if (!dryRun) {
    const mapsDir = path.join(repoPath, '.blinder_maps');
    fs.mkdirSync(mapsDir, { recursive: true });
    const mapPath = path.join(mapsDir, `${path.basename(maskDir)}.json`);
    fs.writeFileSync(mapPath, JSON.stringify(mappingData, null, 2));
  }

  return mappingData;
}

function calculateHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err: Error) => reject(err));
  });
}
