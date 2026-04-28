import fs from 'fs';
import path from 'path';

/**
 * Read and parse package.json at repoPath. Returns null on missing/invalid.
 */
export function readPackageJson(repoPath) {
  const p = path.join(repoPath, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * True if pkg has the named dependency in dependencies, devDependencies, or peerDependencies.
 */
export function hasDep(pkg, depName) {
  if (!pkg) return false;
  return !!(
    pkg.dependencies?.[depName] ||
    pkg.devDependencies?.[depName] ||
    pkg.peerDependencies?.[depName]
  );
}

/**
 * Detect React build tool from a parsed package.json. Returns 'nextjs' | 'vite' | 'cra' | null.
 */
export function detectReactBuildTool(pkg) {
  if (!pkg) return null;
  if (hasDep(pkg, 'next')) return 'nextjs';
  if (hasDep(pkg, 'vite')) return 'vite';
  if (hasDep(pkg, 'react-scripts')) return 'cra';
  return null;
}

/**
 * True if pkg looks like a frontend project (React/Vue/Svelte/Next/Vite).
 * Used by the Node.js plugin to avoid double-matching with frontend plugins.
 */
export function isFrontendProject(pkg) {
  if (!pkg) return false;
  const frontendDeps = ['react', 'next', 'vite', 'vue', '@angular/core', 'svelte', 'nuxt', 'remix'];
  return frontendDeps.some(d => hasDep(pkg, d));
}
