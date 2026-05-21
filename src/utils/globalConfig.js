import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.blinder');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  language: 'ko'
};

export function getGlobalConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return DEFAULT_CONFIG;
  }
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

export function saveGlobalConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const current = getGlobalConfig();
  const updated = { ...current, ...config };
  const writeOpts = process.platform !== 'win32' ? { mode: 0o600 } : {};
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), writeOpts);
  return updated;
}

/**
 * Returns true when ~/.blinder/config.json was explicitly written (first-run
 * language selection has happened). Mere presence of an in-memory default does
 * not count — we want to detect fresh installs to trigger the language prompt.
 */
export function isLanguageConfigured() {
  return fs.existsSync(CONFIG_FILE);
}
