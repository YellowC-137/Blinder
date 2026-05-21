import fs from 'fs';
import { readSafe } from '../../utils/fsUtils.js';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

export default definePlatform({
  id: 'java',
  name: 'Java',
  category: 'backend',
  astLanguage: 'java',

  // Detect: Maven (pom.xml) or pure Java Gradle, with Maven src/main/java standard layout
  // Excludes: Spring Boot (separate plugin) and Android (com.android.* gradle plugin)
  detect: async (repoPath: string): Promise<boolean> => {
    const pomPath = path.join(repoPath, 'pom.xml');
    const gradlePaths = [
      path.join(repoPath, 'build.gradle'),
      path.join(repoPath, 'build.gradle.kts')
    ];
    const javaSrcDir = path.join(repoPath, 'src/main/java');

    const hasPom = fs.existsSync(pomPath);
    const hasGradle = gradlePaths.some((p: string) => fs.existsSync(p));
    const hasJavaSrc = fs.existsSync(javaSrcDir);

    if (!hasPom && !hasGradle && !hasJavaSrc) return false;

    // Reject Spring Boot — handled by springboot plugin
    if (hasPom && /spring-boot-starter/.test(readSafe(pomPath))) return false;

    for (const gp of gradlePaths) {
      if (!fs.existsSync(gp)) continue;
      const content = readSafe(gp);
      if (/org\.springframework\.boot/.test(content)) return false;
      // Reject Android Gradle Plugin — handled by android plugin
      if (/com\.android\.application|com\.android\.library|com\.android\.tools\.build/.test(content)) return false;
    }

    return true;
  },

  commonExtensions: ['.java', '.properties', '.xml'],

  sensitiveFiles: [
    { glob: '**/*.jks', severity: 'CRITICAL', reason: 'Java KeyStore (앱 서명/암호화 키)' },
    { glob: '**/*.keystore', severity: 'CRITICAL', reason: 'Java KeyStore' },
    { glob: '**/*.p12', severity: 'CRITICAL', reason: 'PKCS#12 keystore' },
    { glob: '**/*.pfx', severity: 'CRITICAL', reason: 'PKCS#12 keystore (Windows naming)' },
    { glob: '**/credentials.properties', severity: 'HIGH', reason: '관용적 자격증명 properties' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*|#)/,

  ignorePaths: [
    '**/target/**',
    '**/build/**',
    '**/.gradle/**',
    '**/.mvn/**',
    '**/out/**'
  ],

  getGitignoreTemplate: (): string => `
# Java
target/
build/
*.class
*.jar
*.war
*.ear
*.hprof
hs_err_pid*.log

# Maven / Gradle
.mvn/
.gradle/

# IDE
.idea/
*.iml
.classpath
.project
.settings/
out/
`,

  getAutoFixReplacement: (_match: string, envVarName: string, ext: string, _options?: Record<string, unknown>): string => {
    if (ext === '.java') return `System.getenv("${envVarName}")`;
    if (ext === '.properties') return `\${${envVarName}}`;
    if (ext === '.xml') return `\${${envVarName}}`;
    return `System.getenv("${envVarName}")`;
  }
});
