import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { sanitizeCustomPatterns } from './regexGuard.js';

/**
 * Loads configuration from .blinderSettings in the project root.
 * customPatterns 는 ReDoS 가드 통과한 항목만 반환된다.
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

      if (!userConfig || typeof userConfig !== 'object' || Array.isArray(userConfig)) {
        throw new Error('Root must be a JSON object');
      }
      if (userConfig.customPatterns !== undefined && !Array.isArray(userConfig.customPatterns)) {
        throw new Error('"customPatterns" must be an array');
      }
      if (userConfig.ignorePaths !== undefined && !Array.isArray(userConfig.ignorePaths)) {
        throw new Error('"ignorePaths" must be an array');
      }

      // Support legacy 'sanitizeOutput' for a smooth transition if present
      if (userConfig.sanitizeOutput && !userConfig.maskOutput) {
        userConfig.maskOutput = userConfig.sanitizeOutput;
      }

      config = { ...config, ...userConfig };

      // customPatterns ReDoS 가드 통과 — 위험한 패턴 제거 후 안전한 것만 보관
      config.customPatterns = sanitizeCustomPatterns(config.customPatterns, logger);

      logger.debug('Loaded configuration from .blinderSettings');
    } catch (error) {
      logger.warn(`Failed to parse .blinderSettings: ${error.message}. Using defaults.`);
    }
  }

  return config;
}
