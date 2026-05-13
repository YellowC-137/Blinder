/**
 * propertiesParser
 *
 * Parses Java-style key=value properties files (gradle.properties,
 * local.properties, *.properties). Strips comments, supports backslash
 * line continuation, and normalizes \\: \\= \\\\ escapes.
 */

const KEY_LINE = /^\s*([\w.\-]+)\s*[=:]\s*(.*)$/;

/**
 * Parse properties content. Returns array of { key, value, line }.
 */
export function parseProperties(content) {
  if (typeof content !== 'string') return [];
  const lines = content.split(/\r?\n/);
  const out = [];

  let i = 0;
  while (i < lines.length) {
    let raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      i++;
      continue;
    }

    let combined = raw;
    let lineStart = i + 1;
    // Count trailing backslashes: odd count = line continuation, even = escaped backslash
    const isLineContinuation = (str) => {
      let count = 0;
      for (let j = str.length - 1; j >= 0 && str[j] === '\\'; j--) count++;
      return count % 2 === 1;
    };
    while (isLineContinuation(combined) && i + 1 < lines.length) {
      combined = combined.slice(0, -1) + lines[++i];
    }

    const m = combined.match(KEY_LINE);
    if (m) {
      let value = m[2];
      // Process \\\\ first to avoid double-replacement
      value = value.replace(/\\\\/g, '\x00').replace(/\\:/g, ':').replace(/\\=/g, '=').replace(/\x00/g, '\\');
      out.push({ key: m[1], value, line: lineStart });
    }
    i++;
  }

  return out;
}
