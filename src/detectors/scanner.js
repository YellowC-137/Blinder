import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
const { glob } = fg;
import { patterns, platformExtensions } from './patterns.js';

export async function scanProject(repoPath, platforms) {
  const results = [];
  const extensions = new Set();
  
  platforms.forEach(p => {
    (platformExtensions[p] || []).forEach(ext => extensions.add(ext));
  });

  if (extensions.size === 0) {
    // Default extensions if no platform detected
    ['.swift', '.kt', '.dart', '.xml', '.plist', '.json', '.env'].forEach(ext => extensions.add(ext));
  }

  const files = await glob(`**/*{${Array.from(extensions).join(',')}}`, {
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/Pods/**', '**/build/**', '**/dist/**', '**/.git/**'],
    absolute: true
  });

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        let match;
        // Reset lastIndex for global regex
        pattern.regex.lastIndex = 0;
        
        while ((match = pattern.regex.exec(line)) !== null) {
          results.push({
            file: path.relative(repoPath, filePath),
            line: i + 1,
            match: match[0],
            patternName: pattern.name,
            severity: pattern.severity,
            content: line.trim()
          });
        }
      }
    }
  }

  return results;
}
