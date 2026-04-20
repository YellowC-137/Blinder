import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;
import { patterns } from './patterns.js';

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
    '**/build/**', 
    '**/dist/**', 
    '**/.git/**',
    '**/.env',
    ...platformIgnores,
    ...(options.ignore || [])
  ];

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
      if (stat.size > 1024 * 1024) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let isComment = false;
        for (const p of platforms) {
          if (p.commentRegex && p.commentRegex.test(line)) {
            isComment = true;
            break;
          }
        }
        if (isComment) continue;

        for (const pattern of allPatterns) {
          let match;
          pattern.regex.lastIndex = 0;
          
          while ((match = pattern.regex.exec(line)) !== null) {
            let matchValue = match[0];
            for (let g = match.length - 1; g >= 1; g--) {
              if (match[g] !== undefined) {
                matchValue = match[g];
                break;
              }
            }
            
            let severity = pattern.severity;
            const isTest = isTestKey(line, filePath, matchValue);
            if (isTest) {
              severity = 'LOW';
            }

            let baseEnvName = pattern.name.toUpperCase().replace(/\s+/g, '_');
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
              line: i + 1,
              match: matchValue,
              fullMatch: match[0],
              patternName: pattern.name,
              envVarName: envVarName,
              severity: severity,
              isTestKey: isTest,
              isSensitiveFile: false,
              content: line.trim(),
              isLikelyExample: isFalsePositive(line, filePath)
            };

            if (result.isLikelyExample && !options.includeExamples) {
              continue;
            }

            results.push(result);
          }
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

