/**
 * manifestParser
 *
 * Extracts <meta-data android:name="X" android:value="Y" /> pairs from
 * AndroidManifest.xml. Order-tolerant: handles name/value in either order
 * and on multiple lines.
 */

const META_TAG_REGEX = /<meta-data\b((?:[^>"]|"[^"]*")*?)\s*\/?>/g;
const ATTR_REGEX = /android:(\w+)\s*=\s*"([^"]*)"/g;

/**
 * Extract meta-data attributes. Returns [{ name, value, resource, line }].
 */
export function parseManifestMetaData(content) {
  if (typeof content !== 'string' || !content.includes('<meta-data')) return [];
  const lines = content.split('\n');
  const lineOffsets = [];
  let cursor = 0;
  for (const ln of lines) {
    lineOffsets.push(cursor);
    cursor += ln.length + 1;
  }

  const out = [];
  META_TAG_REGEX.lastIndex = 0;
  let m;
  while ((m = META_TAG_REGEX.exec(content)) !== null) {
    const tagBody = m[1];
    const offset = m.index;
    // Binary search for the line containing this offset
    let lo = 0, hi = lineOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineOffsets[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    const line = lo + 1;

    const attrs = {};
    ATTR_REGEX.lastIndex = 0;
    let am;
    while ((am = ATTR_REGEX.exec(tagBody)) !== null) {
      attrs[am[1]] = am[2];
    }

    if (attrs.name) {
      out.push({
        name: attrs.name,
        value: attrs.value !== undefined ? attrs.value : null,
        resource: attrs.resource !== undefined ? attrs.resource : null,
        line
      });
    }
  }

  return out;
}

export function isAndroidManifest(filePath) {
  if (typeof filePath !== 'string') return false;
  return /(?:^|\/)AndroidManifest\.xml$/.test(filePath);
}
