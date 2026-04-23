import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;
import { patterns } from './patterns.js';
import logger from '../utils/logger.js';

/**
 * Heuristic to detect if a match is likely a false positive.
 */
function isFalsePositive(line, filePath) {
  const lowerLine = line.toLowerCase();
  const lowerPath = filePath.toLowerCase();

  const ignoreKeywords = ['example', 'sample', 'placeholder', 'demo', 'mock', 'dummy'];
  return ignoreKeywords.some(kw => lowerPath.includes(kw) || lowerLine.includes(kw));
}

/**
 * Specifically detects if a match is a 'Test' key.
 */
function isTestKey(line, filePath, matchValue) {
  const lowerLine = line.toLowerCase();
  const lowerPath = filePath.toLowerCase();
  const lowerMatch = matchValue.toLowerCase();

  return lowerPath.includes('test') || lowerLine.includes('test') || lowerMatch.includes('test');
}

/**
 * Heuristic to detect if a line is a comment using platform specific regex.
 */
function isCommentLine(line, platforms) {
  return platforms.some(p => p.commentRegex && p.commentRegex.test(line));
}

/**
 * Scans for sensitive files that should never be committed.
 */
async function scanSensitiveFiles(repoPath, platforms) {
  const warnings = [];
  const sensitiveFiles = platforms.flatMap(p => p.sensitiveFiles || []);

  for (const sf of sensitiveFiles) {
    const found = await glob(sf.glob, {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/Pods/**', '**/.git/**'],
      absolute: true
    });

    for (const filePath of found) {
      warnings.push({
        file: path.relative(repoPath, filePath),
        line: 0,
        match: path.basename(filePath),
        fullMatch: path.basename(filePath),
        patternName: `Sensitive File: ${path.basename(filePath)}`,
        severity: sf.severity,
        isTestKey: false,
        isSensitiveFile: true,
        content: sf.reason,
        isLikelyExample: false
      });
    }
  }

  return warnings;
}

/**
 * Detects if a match is likely a false positive based on length, content, and variable name.
 */
function isLowConfidenceMatch(matchValue, patternName, varName = '') {
  // 1. Blacklisted Keywords: Variable names that are unlikely to hold secrets
  if (varName) {
    const blacklist = /(?:CMD|RSP|MSG|COLOR|ERR_CODE|RSP_CODE|STATUS_CODE|TYPE|ID|FLAG|NAME|TITLE|DESC|TEXT|STR_KEY|PARAM_|FIELD_|ATTR_|PROP_|VAL_)/i;
    if (blacklist.test(varName)) {
      return true;
    }
  }

  // 2. Patterns that are naturally noisy (Generic/Config) require further checks
  if (patternName.includes('Config String') || patternName.includes('Macro String') || patternName.includes('Generic')) {
    if (matchValue.length < 8) {
      return true;
    }
    if (/^\d+$/.test(matchValue)) {
      return true;
    }
  }

  return false;
}

export async function scanProject(repoPath, platforms, options = {}) {
  const results = [];
  const extensions = new Set();
  const usedEnvNames = new Map();

  platforms.forEach(p => {
    (p.commonExtensions || []).forEach(ext => extensions.add(ext));
  });

  if (extensions.size === 0) {
    ['.swift', '.kt', '.dart', '.xml', '.plist', '.json', '.env', '.properties', '.gradle'].forEach(ext => extensions.add(ext));
  }

  const platformIgnores = platforms.flatMap(p => p.ignorePaths || []);
  const ignorePatterns = [
    '**/node_modules/**',
    '**/Pods/**',
    '**/Carthage/**',
    '**/vendor/**',
    '**/third_party/**',
    '**/build/**',
    '**/dist/**',
    '**/.git/**',
    '**/.env',
    ...platformIgnores,
    ... (options.ignore || [])
  ];

  // Load custom ignore paths from .blinderSettings if it exists
  const rcPath = path.join(repoPath, '.blinderSettings');
  if (fs.existsSync(rcPath)) {
    try {
      const rcContent = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      if (Array.isArray(rcContent.ignorePaths)) {
        ignorePatterns.push(...rcContent.ignorePaths);
      }
    } catch (err) {
      logger.warn('Failed to parse .blinderSettings. Skipping custom ignore paths.');
    }
  }

  const files = await glob(`**/*{${Array.from(extensions).join(',')}}`, {
    cwd: repoPath,
    ignore: ignorePatterns,
    absolute: true
  });

  const allPatterns = [...patterns, ...(options.customPatterns || [])];

  for (const filePath of files) {
    try {
      const ext = path.extname(filePath);
      const stat = fs.statSync(filePath);
      if (stat.size > 2 * 1024 * 1024) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Heuristic: Skip files that look like third-party SDKs or legacy libraries
      const firstTenLines = lines.slice(0, 10).join('\n').toLowerCase();
      const sdkKeywords = ['copyright', 'third-party', 'licensed to', 'all rights reserved', 'sdk', 'original author'];
      if (sdkKeywords.some(kw => firstTenLines.includes(kw))) {
        continue;
      }

      for (const pattern of allPatterns) {
        pattern.regex.lastIndex = 0;
        let match;

        while ((match = pattern.regex.exec(content)) !== null) {
          let matchValue = match[0];
          let varName = '';

          // 1. Primary Extraction (from pattern capture groups)
          if (pattern.name === 'Objective-C Config String' && match[1]) {
            varName = match[1];
            matchValue = match[2];
          } else if (pattern.name === 'Objective-C Macro String' && match[1]) {
            varName = match[1];
            matchValue = match[2];
          } else {
            for (let g = match.length - 1; g >= 1; g--) {
              if (match[g] !== undefined) {
                matchValue = match[g];
                break;
              }
            }
          }

          // 2. Secondary Look-back (for Objective-C generic patterns like Endpoint URL)
          if (!varName && (ext === '.m' || ext === '.h' || ext === '.mm')) {
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const preMatch = content.substring(lineStart, match.index);
            const lookbackRegex = /(?:NSString\s*\*\s*const|const\s+NSString\s*\*|#define)\s+([a-zA-Z0-9_]+)\s*(?:=|)\s*@?\s*["']?$/i;
            const varMatch = preMatch.trim().match(lookbackRegex);
            if (varMatch) {
              varName = varMatch[1];
            }
          }

          const startLine = getLineNumber(content, match.index);
          const currentLineText = lines[startLine - 1] || '';
          const isComment = isCommentLine(currentLineText, platforms);

          let severity = pattern.severity;
          const isTest = isTestKey(currentLineText, filePath, matchValue);
          if (isTest) {
            severity = 'LOW';
          }

          // --- Confidence Filtering ---
          if (isLowConfidenceMatch(matchValue, pattern.name, varName)) {
            continue;
          }
          // ----------------------------

          let baseEnvName = pattern.name.toUpperCase().replace(/\s+/g, '_');

          if ((pattern.name === 'Objective-C Config String' || pattern.name === 'Objective-C Macro String') && varName) {
            baseEnvName = varName.toUpperCase();
          } else if (pattern.name === 'Objective-C Config Number' && match[2]) {
            baseEnvName = match[2].toUpperCase();
          }

          let envVarName = baseEnvName;

          const existingValue = usedEnvNames.get(envVarName);
          if (existingValue && existingValue !== matchValue) {
            let counter = 1;
            while (usedEnvNames.has(`${baseEnvName}_${counter}`) && usedEnvNames.get(`${baseEnvName}_${counter}`) !== matchValue) {
              counter++;
            }
            envVarName = `${baseEnvName}_${counter}`;
          }
          usedEnvNames.set(envVarName, matchValue);

          const result = {
            file: path.relative(repoPath, filePath),
            line: startLine,
            match: matchValue,
            fullMatch: match[0],
            patternName: pattern.name,
            envVarName: envVarName,
            severity: severity,
            isFixable: pattern.isFixable !== false,
            isTestKey: isTest,
            isSensitiveFile: false,
            isComment: isComment,
            isMultiline: pattern.multiline || match[0].includes('\n'),
            content: currentLineText.trim(),
            isLikelyExample: isFalsePositive(currentLineText, filePath),
            groups: match.slice(1)
          };

          if (result.isLikelyExample && !options.includeExamples) {
            continue;
          }

          results.push(result);
        }
      }
    } catch (err) {
      continue;
    }
  }

  const fileWarnings = await scanSensitiveFiles(repoPath, platforms);
  results.push(...fileWarnings);

  return results;
}

/**
 * Gets the line number of a specific index in a string.
 */
function getLineNumber(content, index) {
  const prefix = content.substring(0, index);
  return prefix.split('\n').length;
}
