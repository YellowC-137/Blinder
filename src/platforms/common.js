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

  getGitignoreTemplate: () => `
# Blinder
.env
.env.example
blinder_reports/
.blinder_masked/
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
  }
};
