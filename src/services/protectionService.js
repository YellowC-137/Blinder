import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';

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
 * findEnclosingStringLiteral
 *
 * Determines whether a substring at [matchStart, matchEnd) sits inside a
 * single-line string literal. Walks the line scanning for unescaped string
 * delimiters (", ', `). Returns the bounds of the enclosing literal
 * (start = position of opening quote, end = position AFTER closing quote)
 * and the quote character used. Returns null if not inside a literal.
 *
 * Used by the basic-fix path to expand the replacement target from a
 * partial substring (which would leave broken quotes around the injected
 * accessor — e.g. `"process.env.X" + trailing chars within original quotes`)
 * to the entire string literal so the accessor replaces the literal as an
 * expression.
 */
function findEnclosingStringLiteral(lineContent, matchStart, matchEnd) {
  let openIdx = -1;
  let openChar = '';
  let inString = false;
  let curChar = '';
  let curStart = -1;

  for (let i = 0; i < matchStart; i++) {
    const c = lineContent[i];
    if (c === '\\') { i++; continue; }
    if (!inString) {
      if (c === '"' || c === "'" || c === '`') {
        inString = true;
        curChar = c;
        curStart = i;
      }
    } else if (c === curChar) {
      inString = false;
      curChar = '';
      curStart = -1;
    }
  }

  if (!inString) return null;
  openIdx = curStart;
  openChar = curChar;

  for (let i = matchEnd; i < lineContent.length; i++) {
    const c = lineContent[i];
    if (c === '\\') { i++; continue; }
    if (c === openChar) {
      return { start: openIdx, end: i + 1, quoteChar: openChar };
    }
  }

  return null;
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
      try {
        await matchingPlatform.preFix({ repoPath, relPath, absPath, fileSecrets, options });
      } catch (err) {
        throw new Error(t('service_prefix_failed', { name: matchingPlatform.id || matchingPlatform.name, file: relPath, msg: err.message }));
      }
    }

    let contentLines;
    try {
      contentLines = fs.readFileSync(absPath, 'utf8').split('\n');
    } catch (err) {
      logger.error(t('service_read_failed', { file: relPath, msg: err.message }));
      continue;
    }

    let fileModified = false;

    // .json auto-fix is disabled. Code accessors (e.g. process.env.X)
    // injected into JSON values produce non-parsable JSON; placeholder
    // strings (${VAR}) require consumer-specific runtime interpolation
    // (npm, Composer, Heroku app.json all differ), so we skip source
    // modification entirely. Detected secrets still go into .env via
    // prepareEnvContent — user wires interpolation manually if needed.
    if (ext === '.json') {
      const fixable = fileSecrets.filter(s => !s.isSensitiveFile && s.isFixable);
      if (fixable.length > 0) {
        logger.warn(t('service_json_skip', { file: relPath, count: fixable.length }));
      }
      continue;
    }

    for (const s of fileSecrets) {
      if (s.isSensitiveFile || !s.isFixable) continue;

      const { envVarName, match, fullMatch, line } = s;
      if (!envVarName) continue;
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
          prevLine: lineIdx > 0 ? contentLines[lineIdx - 1] : '',
          nextLine: lineIdx + 1 < contentLines.length ? contentLines[lineIdx + 1] : '',
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
          // Platform may signal "handled but no rewrite" (e.g. Spring @Value
          // with ${prop:default} — fallback intentionally left alone).
          if (injectedText) fileModified = true;
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

          if (regexMatch && regexMatch.index !== undefined) {
             const matchIndex = regexMatch.index;
             const matchEndIndex = matchIndex + match.length;
             // If the match sits inside a string literal (e.g., a Slack
             // webhook URL that pattern only partially captured), replace
             // the entire literal so the accessor lands as an expression
             // instead of being wrapped in stale quotes.
             const literal = findEnclosingStringLiteral(lineContent, matchIndex, matchEndIndex);
             if (literal) {
               replacedText = lineContent.substring(literal.start, literal.end);
               injectedText = accessor;
               lineContent = lineContent.substring(0, literal.start) + injectedText + lineContent.substring(literal.end);
             } else {
               replacedText = match;
               injectedText = accessor;
               lineContent = lineContent.substring(0, matchIndex) + injectedText + lineContent.substring(matchEndIndex);
             }
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
        logger.error(t('service_write_failed', { file: relPath, msg: err.message }));
      }
    }

    // Lifecycle Hook: postFix
    if (matchingPlatform?.postFix) {
      for (const s of fileSecrets) {
        if (s.isSensitiveFile || !s.isFixable) continue;
        try {
          await matchingPlatform.postFix({ 
            repoPath, 
            relPath, 
            absPath, 
            fileSecrets, 
            options, 
            ext, 
            envVarName: s.envVarName 
          });
        } catch (err) {
          logger.warn(t('service_postfix_failed', { file: relPath, env: s.envVarName, msg: err.message }));
        }
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
