import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import type { Migration, ProtectionMetadata, RollbackReport } from '../types/index.js';
import type { Platform, RollbackOptions } from '../platforms/types.js';

/**
 * parseEnv
 */
export function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  }
  return env;
}

/**
 * performRollback
 * (보안지침 §7: 복구 메타데이터를 활용한 소스코드 원상 복구 로직)
 */
export async function performRollback(repoPath: string, options: RollbackOptions = {}): Promise<RollbackReport> {
  const metadataPath = path.join(repoPath, '.blinder_protect.json');
  const envPath = path.join(repoPath, '.env');
  const platforms: Platform[] = options.platforms || [];

  const report: RollbackReport = {
    codeRestored: false,
    restoreCount: 0,
    skipCount: 0,
    skipReasons: {
      alreadyRestored: 0,
      fileNotFound: 0,
      secretMissing: 0,
      accessorNotFound: 0
    },
    bridgeResults: [],
    skippedFiles: []
  };

  if (fs.existsSync(metadataPath) && fs.existsSync(envPath)) {
    let metadata: ProtectionMetadata;
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse .blinder_protect.json: ${(err as Error).message}`);
    }
    if (!metadata || typeof metadata !== 'object' || !Array.isArray(metadata.migrations)) {
      throw new Error('Invalid .blinder_protect.json: missing or malformed "migrations" array');
    }
    const envVars = parseEnv(fs.readFileSync(envPath, 'utf8'));
    const { migrations } = metadata;

    // Stable sort: longest first, then by envVarName for determinism
    migrations.sort((a: Migration, b: Migration) => {
      const targetA = a.injectedText || a.accessor;
      const targetB = b.injectedText || b.accessor;
      return targetB.length - targetA.length || (a.envVarName || '').localeCompare(b.envVarName || '');
    });

    // Group migrations by file to batch I/O (sort order preserved within each group)
    const fileGroups = new Map<string, Migration[]>();
    for (const mig of migrations) {
      const list = fileGroups.get(mig.file) || [];
      list.push(mig);
      fileGroups.set(mig.file, list);
    }

    for (const [file, fileMigs] of fileGroups) {
      const absPath = path.join(repoPath, file);

      if (!fs.existsSync(absPath)) {
        report.skippedFiles.push({ file, reason: 'File not found' });
        report.skipCount += fileMigs.length;
        report.skipReasons.fileNotFound += fileMigs.length;
        continue;
      }

      let content = fs.readFileSync(absPath, 'utf8');
      let fileModified = false;

      for (const mig of fileMigs) {
        const { envVarName, accessor } = mig;
        const secretValue = envVars[envVarName];
        if (secretValue === undefined) {
          report.skippedFiles.push({ file, reason: `Secret ${envVarName} not in .env` });
          report.skipCount++;
          report.skipReasons.secretMissing++;
          continue;
        }

        const targetToRemove = mig.injectedText || accessor;
        if (content.includes(targetToRemove)) {
          const restoredValue = mig.replacedText !== undefined ? mig.replacedText : `"${secretValue}"`;
          // Replace first occurrence only to prevent unintended multi-replacements
          // when the same accessor appears in different contexts
          content = content.replace(targetToRemove, restoredValue);
          fileModified = true;
          report.restoreCount++;
        } else {
          const replacedText = mig.replacedText;
          if (replacedText && content.includes(replacedText)) {
            report.skipReasons.alreadyRestored++;
          } else {
            report.skipReasons.accessorNotFound++;
          }
          report.skipCount++;
        }
      }

      if (fileModified && !options.dryRun) {
        fs.writeFileSync(absPath, content);
      }
    }
    report.codeRestored = true;
  }

  // Teardown Bridge
  for (const platform of platforms) {
    if (platform.teardownBridge) {
      if (!options.dryRun) {
        try {
          await platform.teardownBridge(repoPath);
          report.bridgeResults.push({ name: platform.name, success: true });
        } catch (err) {
          report.bridgeResults.push({ name: platform.name, success: false, error: (err as Error).message });
        }
      }
    }
  }

  return report;
}

/**
 * cleanGitignore
 */
export function cleanGitignore(repoPath: string): boolean {
  const gitignorePath = path.join(repoPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    // Match BLINDER blocks at file start (^) or after newline (\n)
    const blinderRegex = /(?:^|\n)# --- BLINDER [A-Z]+ ---\n[\s\S]*?(?=\n# --- BLINDER|$)/g;

    blinderRegex.lastIndex = 0;
    const hasBlinder = blinderRegex.test(gitignoreContent);
    blinderRegex.lastIndex = 0;
    if (hasBlinder) {
      gitignoreContent = gitignoreContent.replace(blinderRegex, '');
      gitignoreContent = gitignoreContent.trim() + '\n';
      fs.writeFileSync(gitignorePath, gitignoreContent);
      return true;
    }
  }
  return false;
}
