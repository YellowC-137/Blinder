import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { detectProjectType } from '../utils/detector.js';
import { scanProject } from '../detectors/scanner.js';
import { hookMapPath, SHADOW_DIR } from '../services/hookExec.js';
import type { MaskingMap, CodeSecretMatch } from '../types/index.js';

const HOOK_COMMAND = 'blinder-hook';
const DENY_RULES = ['Read(.env)', 'Read(.env.*)', 'Read(.blinder_maps/**)'];

/**
 * blinder hook install
 * Scans the project, writes the secret map to .blinder_maps/_hook.json, and
 * registers a Claude Code PreToolUse(Read) hook in .claude/settings.json so
 * secret-bearing files are read through masked shadow copies.
 */
export async function installHook(repoPath: string): Promise<void> {
  const project = await detectProjectType(repoPath);
  logger.info(t('scanning_secrets'));
  const results = await scanProject(repoPath, project.platforms, { ignore: [`${SHADOW_DIR}/**`] });
  const secrets = results.filter(
    (r): r is CodeSecretMatch => !r.isSensitiveFile && !r.isComment && Boolean((r as CodeSecretMatch).envVarName)
  );

  const map: MaskingMap = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    projectRoot: repoPath,
    maskDir: SHADOW_DIR,
    mappings: {},
    fileHashes: {},
    allFiles: []
  };
  for (const s of secrets) {
    // Same envVarName with a different value must not be dropped — an
    // unmapped value would be served to the agent unmasked.
    let name = s.envVarName;
    let n = 2;
    while (map.mappings[name] && map.mappings[name].originalValue !== s.match) {
      name = `${s.envVarName}_${n++}`;
    }
    map.mappings[name] ??= { originalValue: s.match, redactedTag: `__BLINDER_${name}__`, files: [] };
    if (!map.mappings[name].files.includes(s.file)) map.mappings[name].files.push(s.file);
  }

  const mapFile = hookMapPath(repoPath);
  fs.mkdirSync(path.dirname(mapFile), { recursive: true });
  fs.writeFileSync(mapFile, JSON.stringify(map, null, 2));

  // Invalidate stale shadows from a previous install in one stroke — they
  // are regenerated on demand from the fresh map.
  fs.rmSync(path.join(repoPath, SHADOW_DIR), { recursive: true, force: true });

  updateClaudeSettings(repoPath);
  ensureHookGitignore(repoPath);

  const fileCount = new Set(secrets.map(s => s.file)).size;
  logger.header(t('hook_install_done'));
  if (secrets.length === 0) logger.info(t('hook_no_secrets'));
  logger.info(t('hook_install_summary', {
    secrets: String(Object.keys(map.mappings).length),
    files: String(fileCount),
    map: mapFile
  }));
  logger.warn(t('hook_restart_note'));
}

function updateClaudeSettings(repoPath: string): void {
  const settingsDir = path.join(repoPath, '.claude');
  const settingsFile = path.join(settingsDir, 'settings.json');
  // Corrupt JSON throws to the user instead of silently clobbering settings.
  const settings = fs.existsSync(settingsFile)
    ? JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
    : {};

  settings.hooks ??= {};
  settings.hooks.PreToolUse ??= [];
  const entries = settings.hooks.PreToolUse as Array<{ matcher?: string; hooks?: Array<{ command?: string }> }>;
  const MATCHER = 'Read|Edit|Write';
  const existing = entries.find(e => (e.hooks ?? []).some(h => h.command === HOOK_COMMAND));
  if (existing) {
    existing.matcher = MATCHER; // upgrade installs made by older versions
  } else {
    entries.push({ matcher: MATCHER, hooks: [{ type: 'command', command: HOOK_COMMAND, timeout: 30 } as { command: string }] });
  }

  settings.permissions ??= {};
  settings.permissions.deny ??= [];
  for (const rule of DENY_RULES) {
    if (!settings.permissions.deny.includes(rule)) settings.permissions.deny.push(rule);
  }

  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  logger.success(t('hook_settings_updated', { path: settingsFile }));
}

function ensureHookGitignore(repoPath: string): void {
  const gitignorePath = path.join(repoPath, '.gitignore');
  const current = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const wanted = [`${SHADOW_DIR}/`, '.blinder_maps/'].filter(line => !current.includes(line));
  if (wanted.length === 0) return;
  // Same marker convention as generateGitignore so rollback tooling can
  // remove the block without touching user lines.
  const block = `\n# --- BLINDER HOOK ---\n${wanted.join('\n')}\n# --- BLINDER HOOK END ---\n`;
  fs.writeFileSync(gitignorePath, current + block);
}
