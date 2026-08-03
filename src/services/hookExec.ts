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
  tool_input?: { file_path?: string; [key: string]: unknown };
}

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
 * PreToolUse(Read) handler: when the target file is registered in the hook
 * map as secret-bearing, redirect the read to an on-demand masked shadow
 * copy under .blinder_shadow/. Returns null to defer to the normal flow.
 */
export function handleHookInput(input: PreToolUseInput, repoRootOverride?: string): HookDecision | null {
  if (input.hook_event_name !== 'PreToolUse' || input.tool_name !== 'Read') return null;
  const filePath = input.tool_input?.file_path;
  if (!filePath) return null;

  const repoRoot = repoRootOverride ?? process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
  if (!repoRoot || !fs.existsSync(hookMapPath(repoRoot))) return null;

  const mapFile = hookMapPath(repoRoot);
  let map: MaskingMap;
  try {
    map = JSON.parse(fs.readFileSync(mapFile, 'utf8')) as MaskingMap;
  } catch {
    // Can't know which files hold secrets — fail closed rather than leak.
    return deny('Blinder hook map is unreadable. Re-run "blinder hook install".');
  }

  const absPath = path.resolve(repoRoot, filePath);
  const relPath = path.relative(repoRoot, absPath);
  if (relPath.startsWith('..') || path.isAbsolute(relPath)) return null; // outside project
  if (relPath.split(path.sep)[0] === SHADOW_DIR) return null; // already a shadow read

  const mapped = Object.values(map.mappings ?? {}).some(m => m.files?.includes(relPath));
  if (!mapped) return null;

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
