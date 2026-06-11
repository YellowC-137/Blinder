import fs from 'fs';

/**
 * Reads a file as UTF-8, returning '' on any error (missing / permission / etc.).
 */
export function readSafe(p: string): string {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}
