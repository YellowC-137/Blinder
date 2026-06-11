import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import type { Platform } from '../platforms/types.js';

interface BridgeOptions {
  platforms?: Platform[];
}

/**
 * Automates native build system integration to read .env files using platform plugins.
 */
export async function bridgeProject(repoPath: string, options: BridgeOptions = {}): Promise<void> {
  logger.header(t('bridge_header'));
  
  const platforms: Platform[] = options.platforms || [];

  if (platforms.length === 0) {
    logger.warn(t('bridge_no_platforms'));
    return;
  }

  const platformNames: string = platforms.map((p: Platform) => p.name).join(', ');
  logger.info(t('bridge_tethering', { names: platformNames }));

  for (const platform of platforms) {
    if (platform.setupBridge) {
      try {
        await platform.setupBridge(repoPath);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(t('bridge_failed', { name: platform.name, msg: message }));
      }
    }
  }

  logger.divider();
  logger.success(t('bridge_complete'));
}
