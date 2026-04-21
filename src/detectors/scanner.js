import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;
import { patterns, platformExtensions, sensitiveFiles } from './patterns.js';

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
 * Heuristic to detect if a line is a comment.
 */
function isCommentLine(line, ext) {
  const trimmed = line.trim();
  if (ext === '.swift' || ext === '.kt' || ext === '.java' || ext === '.dart' || ext === '.m' || ext === '.h' || ext === '.mm' || ext === '.c' || ext === '.cpp') {
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  }
  if (ext === '.yaml' || ext === '.gradle' || ext === '.properties' || ext === '.py' || ext === '.sh') {
    return trimmed.startsWith('#');
  }
  if (ext === '.xml' || ext === '.plist') {
    return trimmed.startsWith('<!--');
  }
  return false;
}

/**
 * Scans for sensitive files that should never be committed.
 */
async function scanSensitiveFiles(repoPath, platforms) {
  const warnings = [];

  for (const sf of sensitiveFiles) {
    if (platforms.length > 0 && !platforms.includes(sf.platform) && !platforms.includes('flutter')) {
      continue;
    }

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
    (platformExtensions[p] || []).forEach(ext => extensions.add(ext));
  });

  if (extensions.size === 0) {
    ['.swift', '.kt', '.dart', '.xml', '.plist', '.json', '.env', '.properties', '.gradle'].forEach(ext => extensions.add(ext));
  }

  const ignorePatterns = [
    '**/node_modules/**', 
    '**/Pods/**', 
    '**/build/**', 
    '**/dist/**', 
    '**/.git/**',
    '**/.env',
    '**/*.xcframework/**',
    '**/*.framework/**',
    '**/Carthage/**',
    '**/DerivedData/**',
    '**/.build/**',
    '**/.swiftpm/**',
    '**/Package.swift',
    '**/Project.swift',
    '**/Dependencies.swift',
    '**/Workspace.swift',
    '**/Podfile',
    '**/Cartfile',
    '**/*.pbxproj',
    '**/*Tests/**',
    '**/*Test/**',
    '**/*.xctest/**',
    '**/test/**',
    '**/androidTest/**',
    ...sensitiveFiles.map(sf => sf.glob),
    ... (options.ignore || [])
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
      if (stat.size > 2 * 1024 * 1024) continue; // Increased limit slightly for multi-line search

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (const pattern of allPatterns) {
        pattern.regex.lastIndex = 0;
        let match;
        
        while ((match = pattern.regex.exec(content)) !== null) {
          let matchValue = match[0];
          // Support capture groups (prefer the last non-empty capture group)
          for (let g = match.length - 1; g >= 1; g--) {
            if (match[g] !== undefined) {
              matchValue = match[g];
              break;
            }
          }
          
          const startLine = getLineNumber(content, match.index);
          const currentLineText = lines[startLine - 1] || '';
          const isComment = isCommentLine(currentLineText, ext);
          
          let severity = pattern.severity;
          const isTest = isTestKey(currentLineText, filePath, matchValue);
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
            isLikelyExample: isFalsePositive(currentLineText, filePath)
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

/**
 * Gets the line number of a specific index in a string.
 */
function getLineNumber(content, index) {
  const prefix = content.substring(0, index);
  return prefix.split('\n').length;
}

  const fileWarnings = await scanSensitiveFiles(repoPath, platforms);
  results.push(...fileWarnings);

  return results;
}

