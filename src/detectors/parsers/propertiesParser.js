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
    while (combined.endsWith('\\') && i + 1 < lines.length) {
      combined = combined.slice(0, -1) + lines[++i];
    }

    const m = combined.match(KEY_LINE);
    if (m) {
      let value = m[2];
      value = value.replace(/\\:/g, ':').replace(/\\=/g, '=').replace(/\\\\/g, '\\');
      out.push({ key: m[1], value, line: lineStart });
    }
    i++;
  }

  return out;
}
