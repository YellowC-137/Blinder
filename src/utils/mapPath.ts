import path from 'path';

// Single source of truth for where a maskDir's secret map lives.
export function mapPathFor(repoPath: string, maskDir: string): string {
  return path.join(repoPath, '.blinder_maps', `${path.basename(maskDir)}.json`);
}

// Pre-relocation layout: the map lived inside the mask directory itself.
export function legacyMapPathFor(maskDir: string): string {
  return path.join(maskDir, '.blinder_map.json');
}
