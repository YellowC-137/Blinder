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

const KEY_VALUE_REGEX = /<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g;

/**
 * Extract <key>/<string> pairs from a plist XML string.
 * Returns array of { key, value, line }.
 */
export function parsePlist(content) {
  if (typeof content !== 'string' || !content.includes('<key>')) return [];
  const lines = content.split('\n');
  const lineOffsets = [];
  let cursor = 0;
  for (const ln of lines) {
    lineOffsets.push(cursor);
    cursor += ln.length + 1;
  }

  const out = [];
  KEY_VALUE_REGEX.lastIndex = 0;
  let m;
  while ((m = KEY_VALUE_REGEX.exec(content)) !== null) {
    const offset = m.index;
    const lineIndex = lineOffsets.findIndex((o, i) => o <= offset && (lineOffsets[i + 1] === undefined || lineOffsets[i + 1] > offset));
    const line = lineIndex >= 0 ? lineIndex + 1 : 1;
    out.push({ key: m[1].trim(), value: m[2].trim(), line });
  }
  return out;
}

/**
 * Predicate to recognize Info.plist files (any variant).
 */
export function isInfoPlist(filePath) {
  if (typeof filePath !== 'string') return false;
  return /(?:^|\/)Info(?:-[A-Za-z]+)?\.plist$/.test(filePath);
}
