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
 * True if pkg has the named dependency in production dependencies only
 * (excludes devDependencies and peerDependencies).
 *
 * Used for project-classification decisions where dev/peer deps would cause
 * false positives — e.g., a Strapi backend package lists `react` as a peer
 * dep for admin tooling but is not a React frontend project.
 */
export function hasRuntimeDep(pkg, depName) {
  if (!pkg) return false;
  return !!pkg.dependencies?.[depName];
}

/**
 * Detect React build tool from a parsed package.json. Returns 'nextjs' | 'vite' | 'cra' | null.
 *
 * Checks all dependency categories — Vite/CRA/Next are typically declared in
 * devDependencies. Project-classification (is this a React project?) is
 * separately gated by `isFrontendProject` / `react.detect` which use runtime
 * deps only, so this looser check is safe.
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
 *
 * Uses runtime dependencies only.
 */
export function isFrontendProject(pkg) {
  if (!pkg) return false;
  const frontendDeps = ['react', 'next', 'vite', 'vue', '@angular/core', 'svelte', 'nuxt', 'remix'];
  return frontendDeps.some(d => hasRuntimeDep(pkg, d));
}
