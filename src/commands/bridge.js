import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';

/**
 * Automates native build system integration to read .env files using platform plugins.
 */
export async function bridgeProject(repoPath, options = {}) {
  logger.header(t('bridge_header'));
  
  const platforms = options.platforms || [];

  if (platforms.length === 0) {
    logger.warn(t('bridge_no_platforms'));
    return;
  }

  const platformNames = platforms.map(p => p.name).join(', ');
  logger.info(t('bridge_tethering', { names: platformNames }));

  for (const platform of platforms) {
    if (platform.setupBridge) {
      try {
        await platform.setupBridge(repoPath);
      } catch (err) {
        logger.error(t('bridge_failed', { name: platform.name, msg: err.message }));
      }
    }
  }

  logger.divider();
  logger.success(t('bridge_complete'));
}
