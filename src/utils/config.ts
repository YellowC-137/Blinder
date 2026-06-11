import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { sanitizeCustomPatterns } from './regexGuard.js';
import { t } from './i18n.js';
import type { BlinderConfig } from '../types/index.js';

interface RawConfig {
  customPatterns?: unknown[];
  ignorePaths?: string[];
  maskOutput?: string;
  sanitizeOutput?: string;
  [key: string]: unknown;
}

/**
 * Loads configuration from .blinderSettings in the project root.
 * customPatterns 는 ReDoS 가드 통과한 항목만 반환된다.
 */
export function loadConfig(repoPath: string): BlinderConfig {
  const configPath = path.join(repoPath, '.blinderSettings');
  const projectName = path.basename(repoPath);
  let config: BlinderConfig = {
    customPatterns: [],
    ignorePaths: [],
    maskOutput: `maskedProject_${projectName}`
  };

  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      const userConfig: unknown = JSON.parse(fileContent);

      if (!userConfig || typeof userConfig !== 'object' || Array.isArray(userConfig)) {
        throw new Error('Root must be a JSON object');
      }
      const raw = userConfig as RawConfig;
      if (raw.customPatterns !== undefined && !Array.isArray(raw.customPatterns)) {
        throw new Error('"customPatterns" must be an array');
      }
      if (raw.ignorePaths !== undefined && !Array.isArray(raw.ignorePaths)) {
        throw new Error('"ignorePaths" must be an array');
      }

      // Support legacy 'sanitizeOutput' for a smooth transition if present
      if (raw.sanitizeOutput && !raw.maskOutput) {
        raw.maskOutput = raw.sanitizeOutput;
      }

      config = { ...config, ...raw } as BlinderConfig;

      // customPatterns ReDoS 가드 통과 — 위험한 패턴 제거 후 안전한 것만 보관
      config.customPatterns = sanitizeCustomPatterns(config.customPatterns as unknown[], logger);

      logger.debug(t('config_loaded'));
    } catch (error) {
      logger.warn(t('config_parse_err', { msg: (error as Error).message }));
    }
  }

  return config;
}
