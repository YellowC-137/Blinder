import fs from 'fs';
import path from 'path';

export default {
  id: 'flutter',
  name: 'Flutter',
  category: 'mobile',

  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'pubspec.yaml'));
  },

  commonExtensions: ['.dart', '.yaml'],

  sensitiveFiles: [],

  commentRegex: /^\s*(\/\/|\/\*|\*)/,

  ignorePaths: ['.dart_tool/**', '.pub-cache/**', 'build/**'],

  getGitignoreTemplate: () => `
# Flutter
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
/build/

# Flutter Generated (보안지침 §2)
**/generated_plugin_registrant.dart
`,

  getAutoFixReplacement: (originalMatch, envVarName, fileExtension, options) => {
    return `String.fromEnvironment('${envVarName}')`;
  }
};
