import logger from '../utils/logger.js';

/**
 * Automates native build system integration to read .env files using platform plugins.
 */
export async function bridgeProject(repoPath, options = {}) {
  logger.header('Blinder - Bridge Configuration');
  
  const platforms = options.platforms || [];

  if (platforms.length === 0) {
    logger.warn('No platforms detected for bridging.');
    return;
  }

  const platformNames = platforms.map(p => p.name).join(', ');
  logger.info(`Tethering .env to: ${platformNames}`);

  for (const platform of platforms) {
    if (platform.setupBridge) {
      try {
        await platform.setupBridge(repoPath);
      } catch (err) {
        logger.error(`Failed to setup bridge for ${platform.name}: ${err.message}`);
      }
    }
  }

  logger.divider();
  logger.success('Bridge configuration process complete.');
}
