/**
 * Common Platform Module
 * 
 * Base platform that always applies. Provides common extensions (.env, .json),
 * core gitignore templates, and a default auto-fix replacement.
 */
export default {
  id: 'common',
  name: 'Common Environment',
  category: 'core',

  detect: async (repoPath) => {
    return true; // Common always applies
  },

  commonExtensions: ['.env', '.json'],

  sensitiveFiles: [],

  commentRegex: /^\s*#/,

  ignorePatterns: [
    '**/blinder_reports/**',
    '**/maskedProject_*/**',
    '**/*.pem',
    '**/*.key',
    '**/*.p12',
    '**/*.keystore',
    '**/*.jks'
  ],

  getGitignoreTemplate: () => `
# Blinder
.env
.env.example
blinder_reports/
maskedProject_*/
.blinder_protect.json
*.pem
*.key
*.p12
*.keystore
*.jks
secrets/
credentials/
`,

  getAutoFixReplacement: (originalMatch, envVarName, fileExtension, options) => {
    return `process.env.${envVarName}`;
  },

  /**
   * Test cases for plugin validation
   */
  testCases: [
    {
      input: '"my-secret-value-12345"',
      expected: 'process.env.MY_SECRET',
      ext: '.json',
      envVarName: 'MY_SECRET'
    }
  ]
};
