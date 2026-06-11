import { platforms } from '../platforms/index.js';
import type { Platform } from '../platforms/types.js';
import logger from './logger.js';

interface ProjectDetection {
  platforms: Platform[];
  root: string;
}

/**
 * Detects the project type using the dynamically loaded platform plugins.
 * Returns an object containing the matching platform objects and the repo root.
 */
export async function detectProjectType(repoPath: string): Promise<ProjectDetection> {
  const result: ProjectDetection = {
    platforms: [],
    root: repoPath
  };

  for (const platform of platforms) {
    try {
      if (await platform.detect(repoPath)) {
        result.platforms.push(platform);
      }
    } catch (err: unknown) {
      logger.debug(`Platform ${platform.name || platform.id} detection failed: ${(err as Error).message}`);
    }
  }

  // Ensure 'common' is always present if not already added
  if (!result.platforms.some((p: Platform) => p.id === 'common')) {
    const common: Platform | undefined = platforms.find((p: Platform) => p.id === 'common');
    if (common) result.platforms.unshift(common);
  }

  return result;
}
