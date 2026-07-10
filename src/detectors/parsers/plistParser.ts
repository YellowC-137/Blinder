/**
 * plistParser
 *
 * Lightweight Info.plist XML parser that yields { key, value, line } pairs
 * for top-level <key>/<string> entries inside the root <dict>.
 *
 * Limitations (intentional): does not handle nested dicts/arrays beyond
 * shallow extraction. Sufficient for SDK key detection (KAKAO_*, NAVER_*,
 * GoogleAPIKey, etc.) which lives at the top level.
 */

import { buildLineIndex, lineNumberAt } from '../scannerHelpers.js';
import type { ParsedEntry } from './types.js';

const KEY_VALUE_REGEX = /<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g;

/**
 * Extract <key>/<string> pairs from a plist XML string.
 * Returns array of { key, value, line }.
 */
export function parsePlist(content: string): ParsedEntry[] {
  if (typeof content !== 'string' || !content.includes('<key>')) return [];
  const lineStarts = buildLineIndex(content);

  const out: ParsedEntry[] = [];
  KEY_VALUE_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = KEY_VALUE_REGEX.exec(content)) !== null) {
    out.push({ key: m[1].trim(), value: m[2].trim(), line: lineNumberAt(lineStarts, m.index) });
  }
  return out;
}

/**
 * Predicate to recognize Info.plist files (any variant).
 */
export function isInfoPlist(filePath: string): boolean {
  if (typeof filePath !== 'string') return false;
  return /(?:^|\/)Info(?:-[A-Za-z]+)?\.plist$/.test(filePath);
}
