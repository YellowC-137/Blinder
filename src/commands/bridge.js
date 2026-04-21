import logger from '../utils/logger.js';
import { detectProjectType } from '../utils/detector.js';
import { setupAndroidBridge } from '../utils/androidBridge.js';
import { setupIosBridge } from '../utils/iosBridge.js';
import { setupFlutterBridge } from '../utils/flutterBridge.js';

/**
 * Automates native build system integration to read .env files.
 */
export async function bridgeProject(repoPath, options = {}) {
  logger.header('Blinder - Bridge Configuration');
  
  const project = await detectProjectType(repoPath);
  const platforms = project.platforms;

  if (platforms.length === 0) {
    logger.warn('No mobile platforms detected. Generic bridge is not available.');
    return;
  }

  logger.info(`Tethering .env to: ${platforms.join(', ')}`);

  if (platforms.includes('android')) {
    await setupAndroidBridge(repoPath);
  }

  if (platforms.includes('ios')) {
    await setupIosBridge(repoPath);
  }

  if (platforms.includes('flutter')) {
    await setupFlutterBridge(repoPath);
  }

  logger.divider();
  logger.success('Bridge configuration process complete.');
}
