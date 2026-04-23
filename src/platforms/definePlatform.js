/**
 * definePlatform - Platform Plugin Helper
 * 
 * Wraps a platform configuration object with sensible defaults,
 * reducing boilerplate for plugin authors. Inspired by Vite's defineConfig().
 * 
 * Usage:
 *   import { definePlatform } from '../definePlatform.js';
 *   export default definePlatform({ id: 'ruby', name: 'Ruby', ... });
 * 
 * @param {Object} config - Platform configuration object
 * @param {string} config.id - Unique identifier (lowercase, alphanumeric)
 * @param {string} config.name - Human-readable display name
 * @param {string} [config.category='custom'] - Category: 'core', 'mobile', 'backend', 'web', 'custom'
 * @param {function} config.detect - async (repoPath) => boolean
 * @param {string[]} config.commonExtensions - File extensions to scan
 * @param {Object[]} [config.sensitiveFiles=[]] - Sensitive file definitions
 * @param {RegExp} [config.commentRegex] - Regex to identify comment lines
 * @param {string[]} [config.ignorePaths=[]] - Glob patterns to exclude from scan
 * @param {function} [config.getGitignoreTemplate] - Returns .gitignore content
 * @param {function} [config.getAutoFixReplacement] - Returns env variable accessor code
 * @param {function} [config.applyAdvancedFix] - Complex source code transformation (Stage 1)
 * @param {function} [config.preFix] - Pre-modification hook
 * @param {function} [config.postFix] - Post-modification hook
 * @param {function} [config.setupBridge] - Build system .env integration
 * @param {function} [config.teardownBridge] - Build system .env teardown
 * @param {Object[]} [config.testCases=[]] - Validation test cases
 * @returns {Object} Complete platform configuration with defaults applied
 */
export function definePlatform(config) {
  if (!config.id) throw new Error('Platform plugin must have an "id" property.');
  if (!config.name) throw new Error('Platform plugin must have a "name" property.');
  if (!config.detect) throw new Error('Platform plugin must have a "detect" method.');
  if (!config.commonExtensions || config.commonExtensions.length === 0) {
    throw new Error('Platform plugin must have at least one entry in "commonExtensions".');
  }

  return {
    // Defaults for optional properties
    category: 'custom',
    sensitiveFiles: [],
    ignorePaths: [],
    commentRegex: /^\s*(\/\/|\/\*|\*|#)/,
    testCases: [],

    // User-provided config overrides defaults
    ...config
  };
}
