import fs from 'fs';
import path from 'path';

/**
 * parseEnv
 */
export function parseEnv(content) {
  const env = {};
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
export async function performRollback(repoPath, options = {}) {
  const metadataPath = path.join(repoPath, '.blinder_protect.json');
  const envPath = path.join(repoPath, '.env');
  const platforms = options.platforms || [];

  const report = {
    codeRestored: false,
    restoreCount: 0,
    skipCount: 0,
    bridgeResults: [],
    skippedFiles: []
  };

  if (fs.existsSync(metadataPath) && fs.existsSync(envPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const envVars = parseEnv(fs.readFileSync(envPath, 'utf8'));
    const { migrations } = metadata;

    migrations.sort((a, b) => {
      const targetA = a.injectedText || a.accessor;
      const targetB = b.injectedText || b.accessor;
      return targetB.length - targetA.length;
    });

    for (const mig of migrations) {
      const { file, envVarName, accessor } = mig;
      const absPath = path.join(repoPath, file);

      if (!fs.existsSync(absPath)) {
        report.skippedFiles.push({ file, reason: 'File not found' });
        report.skipCount++;
        continue;
      }

      const secretValue = envVars[envVarName];
      if (secretValue === undefined) {
        report.skippedFiles.push({ file, reason: `Secret ${envVarName} not in .env` });
        report.skipCount++;
        continue;
      }

      let content = fs.readFileSync(absPath, 'utf8');
      const targetToRemove = mig.injectedText || accessor;
      if (content.includes(targetToRemove)) {
        const restoredValue = mig.replacedText !== undefined ? mig.replacedText : `"${secretValue}"`;
        content = content.split(targetToRemove).join(restoredValue);

        if (!options.dryRun) {
          fs.writeFileSync(absPath, content);
        }
        report.restoreCount++;
      } else {
        report.skipCount++;
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
          report.bridgeResults.push({ name: platform.name, success: false, error: err.message });
        }
      }
    }
  }

  return report;
}

/**
 * cleanGitignore
 */
export function cleanGitignore(repoPath) {
  const gitignorePath = path.join(repoPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    const blinderRegex = /\n# --- BLINDER [A-Z]+ ---\n[\s\S]*?(?=\n# --- BLINDER|$)/g;
    const blinderRegexFinal = /\n# --- BLINDER [A-Z]+ ---\n[\s\S]*$/g;

    if (blinderRegex.test(gitignoreContent) || blinderRegexFinal.test(gitignoreContent)) {
      gitignoreContent = gitignoreContent.replace(blinderRegex, '').replace(blinderRegexFinal, '');
      gitignoreContent = gitignoreContent.trim() + '\n';
      fs.writeFileSync(gitignorePath, gitignoreContent);
      return true;
    }
  }
  return false;
}
