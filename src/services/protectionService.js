import fs from 'fs';
import path from 'path';

/**
 * findPlatformForExtension
 */
function findPlatformForExtension(platforms, ext) {
  const matching = platforms.find(p => (p.commonExtensions || []).includes(ext));
  if (matching) return matching;
  return platforms.find(p => p.id === 'common') || platforms[0];
}

/**
 * escapeRegExp
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * applyAutoFixes
 * (보안지침 §3: 소스코드 내 하드코딩 제거 및 환경변수 치환 로직)
 */
export async function applyAutoFixes(repoPath, selectedSecrets, options = {}) {
  const platforms = options.platforms || [];
  const fileGroups = selectedSecrets.reduce((acc, res) => {
    if (!acc[res.file]) acc[res.file] = [];
    acc[res.file].push(res);
    return acc;
  }, {});

  const migrations = [];

  for (const [relPath, fileSecrets] of Object.entries(fileGroups)) {
    const absPath = path.join(repoPath, relPath);
    if (!fs.existsSync(absPath)) continue;

    const ext = path.extname(relPath);
    const matchingPlatform = findPlatformForExtension(platforms, ext);

    // Lifecycle Hook: preFix
    if (matchingPlatform?.preFix) {
      await matchingPlatform.preFix({ repoPath, relPath, absPath, fileSecrets, options });
    }

    let contentLines;
    try {
      contentLines = fs.readFileSync(absPath, 'utf8').split('\n');
    } catch (err) {
      logger.error(`Failed to read file ${relPath}: ${err.message}`);
      continue;
    }

    let fileModified = false;

    for (const s of fileSecrets) {
      if (s.isSensitiveFile || !s.isFixable) continue;

      const { envVarName, match, fullMatch, line } = s;
      const lineIdx = line - 1;
      if (lineIdx < 0 || lineIdx >= contentLines.length) continue;

      let accessor = '';
      let injectedText = '';
      let replacedText = '';
      let handledByPlatform = false;

      // Stage 1: Advanced Fix
      if (matchingPlatform?.applyAdvancedFix) {
        const advResult = await matchingPlatform.applyAdvancedFix({
          lineContent: contentLines[lineIdx],
          match,
          fullMatch,
          envVarName,
          ext,
          repoPath,
          relPath,
          options,
          migrations
        });

        if (advResult.handled) {
          contentLines[lineIdx] = advResult.lineContent;
          injectedText = advResult.injectedText;
          replacedText = advResult.replacedText;
          fileModified = true;
          handledByPlatform = true;
        }
      }

      // Stage 2: Basic Fix
      if (!handledByPlatform) {
        if (matchingPlatform?.getAutoFixReplacement) {
          accessor = matchingPlatform.getAutoFixReplacement(match, envVarName, ext, options);
        } else {
          accessor = `process.env.${envVarName}`;
        }

        let lineContent = contentLines[lineIdx];
        const exactObjc = `@"${match}"`;
        const exactDouble = `"${match}"`;
        const exactSingle = `'${match}'`;

        if (lineContent.includes(exactObjc)) {
          replacedText = exactObjc;
          injectedText = accessor;
          lineContent = lineContent.replace(exactObjc, injectedText);
        } else if (lineContent.includes(exactDouble)) {
          replacedText = exactDouble;
          injectedText = accessor;
          lineContent = lineContent.replace(exactDouble, injectedText);
        } else if (lineContent.includes(exactSingle)) {
          replacedText = exactSingle;
          injectedText = accessor;
          lineContent = lineContent.replace(exactSingle, injectedText);
        } else {
          const isAlphanumeric = /^[a-zA-Z0-9_]+$/.test(match);
          const regex = isAlphanumeric ? new RegExp(`\\b${escapeRegExp(match)}\\b`) : new RegExp(escapeRegExp(match));
          const regexMatch = lineContent.match(regex);
          
          if (regexMatch) {
             const matchIndex = regexMatch.index;
             replacedText = match;
             injectedText = accessor;
             lineContent = lineContent.substring(0, matchIndex) + injectedText + lineContent.substring(matchIndex + match.length);
          }
        }

        if (injectedText) {
          contentLines[lineIdx] = lineContent;
          fileModified = true;
        }
      }

      if (injectedText) {
        migrations.push({
          file: relPath,
          envVarName,
          accessor: accessor || injectedText,
          injectedText,
          replacedText: replacedText || match,
          line: s.line
        });
      }
    }

    if (fileModified && !options.dryRun) {
      try {
        fs.writeFileSync(absPath, contentLines.join('\n'));
      } catch (err) {
        logger.error(`Failed to write file ${relPath}: ${err.message}`);
      }
    }

    // Lifecycle Hook: postFix
    if (matchingPlatform?.postFix) {
      try {
        await matchingPlatform.postFix({ repoPath, relPath, absPath, fileSecrets, options, ext, envVarName: fileSecrets[0].envVarName });
      } catch (err) {
        logger.warn(`PostFix hook failed for ${relPath}: ${err.message}`);
      }
    }
  }

  return migrations;
}

/**
 * prepareEnvContent
 */
export function prepareEnvContent(results, existingEnv = '') {
  let envContent = existingEnv;
  let envExampleContent = '';
  const selected = [];

  for (const res of results) {
    const { match, envVarName, secretValue } = res;
    selected.push(res);
    if (!envContent.includes(`${envVarName}=`)) {
      envContent += `${envVarName}=${secretValue}\n`;
      envExampleContent += `${envVarName}=your_secret_here\n`;
    }
  }

  return { selected, envContent, envExampleContent };
}
