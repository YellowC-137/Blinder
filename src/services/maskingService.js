import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * performMasking
 * (보안지침 §6: AI 에이전트 전송용 프로젝트 마스킹 복사본 생성 로직)
 */
export async function performMasking(repoPath, allFiles, results, maskDir, options = {}) {
  const mappingData = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    projectRoot: repoPath,
    mappings: {},
    fileHashes: {},
    allFiles: []
  };

  const secretsByFile = results.reduce((acc, s) => {
    if (!acc[s.file]) acc[s.file] = [];
    acc[s.file].push(s);
    return acc;
  }, {});

  if (!fs.existsSync(maskDir)) {
    fs.mkdirSync(maskDir, { recursive: true });
  }

  for (const relPath of allFiles) {
    const srcPath = path.join(repoPath, relPath);
    const destPath = path.join(maskDir, relPath);

    if (fs.statSync(srcPath).isDirectory()) continue;

    const destFolder = path.dirname(destPath);
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    try {
      if (secretsByFile[relPath]) {
        let content = fs.readFileSync(srcPath, 'utf8');
        const secrets = secretsByFile[relPath];
        secrets.sort((a, b) => b.match.length - a.match.length);

        for (const s of secrets) {
          const mask = `__BLINDER_${s.envVarName}__`;
          content = content.split(s.match).join(mask);

          if (!mappingData.mappings[s.envVarName]) {
            mappingData.mappings[s.envVarName] = {
              originalValue: s.match,
              redactedTag: mask,
              files: []
            };
          }
          if (!mappingData.mappings[s.envVarName].files.includes(relPath)) {
            mappingData.mappings[s.envVarName].files.push(relPath);
          }
        }
        fs.writeFileSync(destPath, content);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }

      // Stream-based hashing to save memory
      mappingData.fileHashes[relPath] = await calculateHash(destPath);
      mappingData.allFiles.push(relPath);
    } catch (err) {
      logger.error(`Failed to process file ${relPath} for masking: ${err.message}`);
      // Continue with other files even if one fails
    }
  }

  const mapPath = path.join(maskDir, '.blinder_map.json');
  fs.writeFileSync(mapPath, JSON.stringify(mappingData, null, 2));

  return mappingData;
}

function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}
