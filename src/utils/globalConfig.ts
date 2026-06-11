import fs from 'fs';
import path from 'path';
import os from 'os';

export interface GlobalConfig {
  language: string;
  [key: string]: unknown;
}

const CONFIG_DIR: string = path.join(os.homedir(), '.blinder');
const CONFIG_FILE: string = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: GlobalConfig = {
  language: 'ko'
};

export function getGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return DEFAULT_CONFIG;
  }
  try {
    const content: string = fs.readFileSync(CONFIG_FILE, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) } as GlobalConfig;
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

export function saveGlobalConfig(config: Partial<GlobalConfig>): GlobalConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const current: GlobalConfig = getGlobalConfig();
  const updated: GlobalConfig = { ...current, ...config };
  const writeOpts: fs.WriteFileOptions = process.platform !== 'win32' ? { mode: 0o600 } : {};
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), writeOpts);
  return updated;
}

/**
 * Returns true when ~/.blinder/config.json was explicitly written (first-run
 * language selection has happened). Mere presence of an in-memory default does
 * not count — we want to detect fresh installs to trigger the language prompt.
 */
export function isLanguageConfigured(): boolean {
  return fs.existsSync(CONFIG_FILE);
}
