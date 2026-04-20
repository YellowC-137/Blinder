import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Loads configuration from .blinderrc in the project root.
 */
export function loadConfig(repoPath) {
  const configPath = path.join(repoPath, '.blinderrc');
  let config = {
    customPatterns: [],
    ignorePaths: [],
    maskOutput: '.blinder_masked'
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
      logger.debug('Loaded configuration from .blinderrc');
    } catch (error) {
      logger.warn(`Failed to parse .blinderrc: ${error.message}. Using defaults.`);
    }
  }

  return config;
}
