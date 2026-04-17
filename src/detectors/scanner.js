import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;
import { patterns, platformExtensions } from './patterns.js';

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
  
  // If it's specifically a 'test' keyword context
  const hasTestKeyword = lowerPath.includes('test') || lowerLine.includes('test') || lowerMatch.includes('test');
  
  return hasTestKeyword;
}

export async function scanProject(repoPath, platforms, options = {}) {
  const results = [];
  const extensions = new Set();
  
  platforms.forEach(p => {
    (platformExtensions[p] || []).forEach(ext => extensions.add(ext));
  });

  if (extensions.size === 0) {
    ['.swift', '.kt', '.dart', '.xml', '.plist', '.json', '.env'].forEach(ext => extensions.add(ext));
  }

  const ignorePatterns = [
    '**/node_modules/**', 
    '**/Pods/**', 
    '**/build/**', 
    '**/dist/**', 
    '**/.git/**',
    '**/.env',
    ... (options.ignore || [])
  ];

  const files = await glob(`**/*{${Array.from(extensions).join(',')}}`, {
    cwd: repoPath,
    ignore: ignorePatterns,
    absolute: true
  });

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of patterns) {
          let match;
          pattern.regex.lastIndex = 0;
          
          while ((match = pattern.regex.exec(line)) !== null) {
            const matchValue = match.length > 1 ? match[match.length - 1] : match[0];
            
            let severity = pattern.severity;
            const isTest = isTestKey(line, filePath, matchValue);
            
            // If it's a test key, force severity to LOW
            if (isTest) {
              severity = 'LOW';
            }

            const result = {
              file: path.relative(repoPath, filePath),
              line: i + 1,
              match: matchValue,
              fullMatch: match[0],
              patternName: pattern.name,
              severity: severity,
              isTestKey: isTest,
              content: line.trim(),
              isLikelyExample: isFalsePositive(line, filePath)
            };

            // Filtering: skip examples unless includeExamples is true or it's CRITICAL (and not a test key)
            if (result.isLikelyExample && severity !== 'CRITICAL' && !options.includeExamples) {
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

  return results;
}
