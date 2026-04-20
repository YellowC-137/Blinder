import fs from 'fs';
import path from 'path';
import { platforms } from '../platforms/index.js';

/**
 * Detects the project type using the dynamically loaded platform plugins.
 * Returns an object containing the matching platform objects and the repo root.
 */
export async function detectProjectType(repoPath) {
  const result = {
    platforms: [],
    root: repoPath
  };

  for (const platform of platforms) {
    try {
      if (await platform.detect(repoPath)) {
        result.platforms.push(platform);
      }
    } catch (err) {
      // Ignore detection errors, simply skip the platform
    }
  }

  return result;
}
