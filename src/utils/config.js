import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Loads configuration from .blinderSettings in the project root.
 */
export function loadConfig(repoPath) {
  const configPath = path.join(repoPath, '.blinderSettings');
  const projectName = path.basename(repoPath);
  let config = {
    customPatterns: [],
    ignorePaths: [],
    maskOutput: `maskedProject_${projectName}`
  };

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      const userConfig = JSON.parse(fileContent);
      
      // Support legacy 'sanitizeOutput' for a smooth transition if present
      if (userConfig.sanitizeOutput && !userConfig.maskOutput) {
        userConfig.maskOutput = userConfig.sanitizeOutput;
      }
      
      config = { ...config, ...userConfig };
      logger.debug('Loaded configuration from .blinderSettings');
    } catch (error) {
      logger.warn(`Failed to parse .blinderSettings: ${error.message}. Using defaults.`);
    }
  }

  return config;
}
