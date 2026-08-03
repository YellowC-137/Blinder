import fs from 'fs';
import path from 'path';
import type { MaskingMap } from '../types/index.js';

// Runs on every Read tool call via the blinder-hook bin entry — keep this
// module dependency-light (fs/path only), never import the CLI graph here.

export const SHADOW_DIR = '.blinder_shadow';

export function hookMapPath(repoRoot: string): string {
  return path.join(repoRoot, '.blinder_maps', '_hook.json');
}

export interface PreToolUseInput {
  hook_event_name?: string;
  tool_name?: string;
  cwd?: string;
  tool_input?: {
    file_path?: string;
    old_string?: string;
    new_string?: string;
    content?: string;
    [key: string]: unknown;
  };
}

const TOKEN_MARKER = '__BLINDER_';

export interface HookDecision {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'allow' | 'deny';
    permissionDecisionReason?: string;
    updatedInput?: Record<string, unknown>;
  };
}

function deny(reason: string): HookDecision {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  };
}

/**
 * PreToolUse handler.
 * Read: when the target file is registered in the hook map as
 * secret-bearing, redirect the read to an on-demand masked shadow copy
 * under .blinder_shadow/.
 * Edit/Write: substitute __BLINDER_*__ tokens in the tool input back to
 * real values so agent edits made against masked content apply cleanly.
 * Returns null to defer to the normal flow.
 */
export function handleHookInput(input: PreToolUseInput, repoRootOverride?: string): HookDecision | null {
  if (input.hook_event_name !== 'PreToolUse') return null;
  const tool = input.tool_name;
  if (tool !== 'Read' && tool !== 'Edit' && tool !== 'Write') return null;
  const filePath = input.tool_input?.file_path;
  if (!filePath) return null;

  const repoRoot = repoRootOverride ?? process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
  if (!repoRoot || !fs.existsSync(hookMapPath(repoRoot))) return null;

  const mapFile = hookMapPath(repoRoot);
  let map: MaskingMap;
  try {
    map = JSON.parse(fs.readFileSync(mapFile, 'utf8')) as MaskingMap;
    // Parseable-but-wrong-shape JSON (torn write, manual edit) must not
    // masquerade as "no mappings" — that would serve secret files raw.
    if (!map || typeof map !== 'object' || Array.isArray(map) ||
        !map.mappings || typeof map.mappings !== 'object') {
      throw new Error('invalid map shape');
    }
  } catch {
    // Can't know which files hold secrets — fail closed rather than leak
    // (Read) or write literal tokens into sources (Edit/Write).
    return deny('Blinder hook map is unreadable. Re-run "blinder hook install".');
  }

  const absPath = path.resolve(repoRoot, filePath);
  const relPath = path.relative(repoRoot, absPath);
  if (relPath.startsWith('..') || path.isAbsolute(relPath)) return null; // outside project
  if (relPath.split(path.sep)[0] === SHADOW_DIR) return null; // shadow itself

  try {
    if (tool === 'Read') return handleRead(repoRoot, relPath, absPath, map, mapFile);
    return handleEditWrite(tool, input, relPath, map, mapFile);
  } catch (err) {
    // An unexpected throw here would otherwise bubble up to blinder-hook,
    // print nothing to stdout, and fall through to a RAW tool call.
    return deny(`Blinder hook failed on ${relPath}: ${(err as Error).message}`);
  }
}

function handleRead(
  repoRoot: string,
  relPath: string,
  absPath: string,
  map: MaskingMap,
  mapFile: string
): HookDecision | null {
  const mapped = Object.values(map.mappings ?? {}).some(m => m.files?.includes(relPath));
  if (!mapped) return null;
  // Deleted since install: nothing to leak — let the tool report it naturally.
  if (!fs.existsSync(absPath)) return null;

  try {
    const shadowAbs = ensureShadow(repoRoot, relPath, absPath, map, fs.statSync(mapFile).mtimeMs);
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        // updatedInput merges into tool_input — only override the path.
        updatedInput: { file_path: shadowAbs }
      }
    };
  } catch (err) {
    // File is known to contain secrets — never fall through to a raw read.
    return deny(`Blinder failed to mask ${relPath}: ${(err as Error).message}`);
  }
}

function handleEditWrite(
  tool: 'Edit' | 'Write',
  input: PreToolUseInput,
  relPath: string,
  map: MaskingMap,
  mapFile: string
): HookDecision | null {
  const fields = tool === 'Edit' ? (['old_string', 'new_string'] as const) : (['content'] as const);
  const toolInput = input.tool_input ?? {};
  if (!fields.some(f => typeof toolInput[f] === 'string' && (toolInput[f] as string).includes(TOKEN_MARKER))) {
    return null;
  }

  const updatedInput: Record<string, string> = {};
  const usedNames = new Set<string>();
  for (const f of fields) {
    const value = toolInput[f];
    if (typeof value !== 'string' || !value.includes(TOKEN_MARKER)) continue;
    let out = value;
    for (const [name, m] of Object.entries(map.mappings ?? {})) {
      if (!m.redactedTag || !out.includes(m.redactedTag)) continue;
      out = out.split(m.redactedTag).join(m.originalValue);
      usedNames.add(name);
    }
    if (out !== value) updatedInput[f] = out;
  }
  if (usedNames.size === 0) return null;

  // The write target now holds real secrets — register it in the map so
  // subsequent Reads of it stay masked (closes the Read→Write→Read leak).
  let mapChanged = false;
  for (const name of usedNames) {
    const files = map.mappings[name].files ?? (map.mappings[name].files = []);
    if (!files.includes(relPath)) {
      files.push(relPath);
      mapChanged = true;
    }
  }
  if (mapChanged) {
    try {
      // Atomic replace: a concurrent blinder-hook must never see a torn map.
      fs.writeFileSync(`${mapFile}.tmp`, JSON.stringify(map, null, 2));
      fs.renameSync(`${mapFile}.tmp`, mapFile);
    } catch (err) {
      // Without the registration a later Read would serve the secret raw.
      return deny(`Blinder could not update its hook map: ${(err as Error).message}`);
    }
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput
    }
  };
}

/**
 * Create (or reuse) the masked shadow copy of one source file. Reuse only
 * when the shadow is newer than both the source and the hook map.
 */
export function ensureShadow(
  repoRoot: string,
  relPath: string,
  srcAbs: string,
  map: MaskingMap,
  mapMtimeMs: number
): string {
  const shadowAbs = path.join(repoRoot, SHADOW_DIR, relPath);
  const srcMtimeMs = fs.statSync(srcAbs).mtimeMs;
  if (fs.existsSync(shadowAbs)) {
    const shadowMtimeMs = fs.statSync(shadowAbs).mtimeMs;
    if (shadowMtimeMs >= srcMtimeMs && shadowMtimeMs >= mapMtimeMs) return shadowAbs;
  }

  let content = fs.readFileSync(srcAbs, 'utf8');
  // Apply every mapping (not just this file's) — same value can reappear in
  // edits after install. Longest value first to avoid partial overlaps.
  const entries = Object.values(map.mappings ?? {})
    .filter(m => m.originalValue)
    .sort((a, b) => b.originalValue.length - a.originalValue.length);
  for (const m of entries) {
    content = content.split(m.originalValue).join(m.redactedTag);
  }

  fs.mkdirSync(path.dirname(shadowAbs), { recursive: true });
  fs.writeFileSync(shadowAbs, content);
  return shadowAbs;
}
