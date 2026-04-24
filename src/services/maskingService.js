import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

    const fileContent = fs.readFileSync(destPath);
    mappingData.fileHashes[relPath] = crypto.createHash('sha256').update(fileContent).digest('hex');
    mappingData.allFiles.push(relPath);
  }

  const mapPath = path.join(maskDir, '.blinder_map.json');
  fs.writeFileSync(mapPath, JSON.stringify(mappingData, null, 2));

  return mappingData;
}
