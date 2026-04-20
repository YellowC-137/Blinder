import fs from 'fs';
import path from 'path';

export default {
  id: 'spring',
  name: 'Java (Spring Boot)',
  category: 'backend',

  detect: async (repoPath) => {
    const hasPomXml = fs.existsSync(path.join(repoPath, 'pom.xml'));
    const hasBuildGradle = fs.existsSync(path.join(repoPath, 'build.gradle'));
    
    // Check if Spring Boot wrapper/metadata exists, or we could just assume Java BE if Java exists
    if (hasPomXml) {
      const pomContent = fs.readFileSync(path.join(repoPath, 'pom.xml'), 'utf8');
      if (pomContent.includes('spring-boot')) return true;
    }
    if (hasBuildGradle) {
      const gradleContent = fs.readFileSync(path.join(repoPath, 'build.gradle'), 'utf8');
      if (gradleContent.includes('org.springframework.boot')) return true;
    }
    
    return false;
  },

  // Target file types for this platform
  commonExtensions: ['.java', '.kt', '.properties', '.yml', '.yaml', '.xml'],

  // Files that should trigger an alert if hardcoded or exposed (empty = rely on common checks)
  sensitiveFiles: [
    { glob: '**/application-prod.yml', severity: 'HIGH', reason: 'Spring Boot 프로덕션 설정 정보' },
    { glob: '**/application-prod.properties', severity: 'HIGH', reason: 'Spring Boot 프로덕션 설정 정보' }
  ],

  // Comment styles for Java/Kotlin/Properties/YAML
  commentRegex: /^\s*(\/\/|\/\*|\*|#)/,

  // Folders to bypass scanning
  ignorePaths: ['target/**', 'build/**', '.gradle/**', 'out/**', 'bin/**'],

  // Gitignore template for Spring Boot / Java
  getGitignoreTemplate: () => `
# Java / Spring Boot
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
pom.xml.next
release.properties
dependency-reduced-pom.xml
buildNumber.properties
.mvn/timing.properties
.mvn/wrapper/maven-wrapper.jar

# Gradle
.gradle
build/
!gradle/wrapper/gradle-wrapper.jar
!**/src/main/**/build/
!**/src/test/**/build/
`,

  // Core Auto-fix formatting
  getAutoFixReplacement: (originalMatch, envVarName, fileExtension, options) => {
    if (fileExtension === '.properties' || fileExtension === '.yml' || fileExtension === '.yaml') {
      return `\${${envVarName}}`; // Spring interpolation, e.g. ${GOOGLE_API_KEY}
    } else if (fileExtension === '.java' || fileExtension === '.kt') {
      return `System.getenv("${envVarName}")`; // Environment fetch in Java/Kotlin
    }
    return `System.getenv("${envVarName}")`;
  }
};
