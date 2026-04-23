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

  // Ensure 'common' is always present if not already added
  if (!result.platforms.some(p => p.id === 'common')) {
    const common = platforms.find(p => p.id === 'common');
    if (common) result.platforms.unshift(common);
  }

  return result;
}
