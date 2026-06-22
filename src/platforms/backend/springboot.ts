import fs from 'fs';
import { readSafe } from '../../utils/fsUtils.js';
import path from 'path';
import { definePlatform } from '../definePlatform.js';
import type { AdvancedFixContext, AdvancedFixResult } from '../types.js';

function detectSpringBoot(repoPath: string): boolean {
  const pomPath = path.join(repoPath, 'pom.xml');
  if (fs.existsSync(pomPath)) {
    const pom = readSafe(pomPath);
    if (/spring-boot-starter/.test(pom) || /<artifactId>\s*spring-boot[^<]*<\/artifactId>/i.test(pom)) {
      return true;
    }
  }
  const gradleCandidates = [
    path.join(repoPath, 'build.gradle'),
    path.join(repoPath, 'build.gradle.kts'),
    path.join(repoPath, 'settings.gradle'),
    path.join(repoPath, 'settings.gradle.kts')
  ];
  for (const gp of gradleCandidates) {
    if (!fs.existsSync(gp)) continue;
    const content = readSafe(gp);
    if (/org\.springframework\.boot/.test(content)) return true;
    if (/id\s*['"]org\.springframework\.boot['"]/.test(content)) return true;
  }
  return false;
}

export default definePlatform({
  id: 'springboot',
  name: 'Spring Boot',
  category: 'backend',
  astLanguage: 'java',

  // Detect: Spring Boot via Maven (spring-boot-starter) or Gradle (org.springframework.boot)
  detect: async (repoPath: string): Promise<boolean> => detectSpringBoot(repoPath),

  commonExtensions: ['.java', '.kt', '.properties', '.yml', '.yaml', '.xml'],

  sensitiveFiles: [
    { glob: '**/application-secret.yml', severity: 'CRITICAL', reason: 'Spring Boot secret profile' },
    { glob: '**/application-secret.yaml', severity: 'CRITICAL', reason: 'Spring Boot secret profile' },
    { glob: '**/application-secret.properties', severity: 'CRITICAL', reason: 'Spring Boot secret profile' },
    { glob: '**/application-prod.yml', severity: 'HIGH', reason: 'prod profile (시크릿 가능)' },
    { glob: '**/application-prod.yaml', severity: 'HIGH', reason: 'prod profile (시크릿 가능)' },
    { glob: '**/application-prod.properties', severity: 'HIGH', reason: 'prod profile (시크릿 가능)' },
    { glob: '**/bootstrap.yml', severity: 'MEDIUM', reason: 'Spring Cloud bootstrap (config-server 자격 가능)' },
    { glob: '**/bootstrap.properties', severity: 'MEDIUM', reason: 'Spring Cloud bootstrap' },
    { glob: '**/*.jks', severity: 'CRITICAL', reason: 'Java KeyStore' },
    { glob: '**/*.p12', severity: 'CRITICAL', reason: 'PKCS#12 keystore' },
    { glob: '**/credentials.properties', severity: 'HIGH', reason: '관용적 자격증명 properties' }
  ],

  commentRegex: /^\s*(\/\/|\/\*|\*|#)/,

  ignorePaths: [
    '**/target/**',
    '**/build/**',
    '**/.gradle/**',
    '**/.mvn/**',
    '**/out/**',
    '**/bin/**',
    // i18n message bundles — natural-language text, never secrets (#4.8)
    '**/messages*.properties',
    '**/messages_*.properties',
    '**/ValidationMessages*.properties',
    // Gradle wrapper distribution URL is fixed launcher metadata (#4.9)
    '**/gradle/wrapper/gradle-wrapper.properties',
    // K8s manifests use ${...} syntax that conflicts with Spring placeholders
    // and breaks DNS resolution if rewritten to ${ENV_NAME} (#4.6)
    '**/k8s/**',
    '**/kubernetes/**',
    '**/helm/**',
    '**/charts/**',
    // DTD / schema files contain reference URLs, not secrets
    '**/*.dtd',
    '**/*.xsd'
  ],

  getGitignoreTemplate: (): string => `
# Spring Boot / Java
target/
build/
*.class
*.jar
*.war
*.original
*.hprof
hs_err_pid*.log

# Spring secret profiles
application-secret.yml
application-secret.yaml
application-secret.properties
application-prod.yml
application-prod.yaml
application-prod.properties

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
bin/
`,

  getAutoFixReplacement: (match: string, envVarName: string, ext: string, _options?: Record<string, unknown>): string => {
    if (ext === '.kt') {
        return `(if (System.getenv("${envVarName}").isNullOrEmpty()) "${match}" else System.getenv("${envVarName}"))`;
    }
    if (ext === '.java') {
        return `(System.getenv("${envVarName}") == null || System.getenv("${envVarName}").isEmpty() ? "${match}" : System.getenv("${envVarName}"))`;
    }
    if (ext === '.properties') return `\${${envVarName}}`;
    if (ext === '.yml' || ext === '.yaml') return `\${${envVarName}}`;
    if (ext === '.xml') return `\${${envVarName}}`;
    return `(System.getenv("${envVarName}") == null || System.getenv("${envVarName}").isEmpty() ? "${match}" : System.getenv("${envVarName}"))`;
  },

  /**
   * Stage 1 — @Value("plain-secret") → @Value("${VAR_NAME}")
   * 평문 리터럴이 들어간 @Value 만 처리. 이미 ${...} placeholder 인 경우는
   * 사용자가 선언한 fallback 일 가능성이 높아 자동 변환을 보류한다 (#4.2).
   */
  applyAdvancedFix: async (context: AdvancedFixContext): Promise<AdvancedFixResult> => {
    const { lineContent, match, envVarName, ext } = context;
    if (ext !== '.java' && ext !== '.kt') return { handled: false };
    if (!lineContent.includes('@Value')) return { handled: false };

    const valueRegex = /@Value\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/;
    const m = lineContent.match(valueRegex);
    if (!m) return { handled: false };
    const literal = m[1];

    // ${prop:default} or #{SpEL} — secret embedded in the default segment is
    // a deliberate fallback. Auto-injecting System.getenv() inside the SpEL
    // string both breaks Java syntax and silently changes runtime semantics
    // (Spring evaluates the default as a literal string, not as code). Mark
    // handled with no rewrite so the basic-fix pass also skips it.
    if (literal.startsWith('${') || literal.startsWith('#{')) {
      return {
        handled: true,
        lineContent,
        injectedText: '',
        replacedText: ''
      };
    }
    if (!literal.includes(match)) return { handled: false };

    const replaced = lineContent.replace(
      valueRegex,
      `@Value("\${${envVarName}}")`
    );

    return {
      handled: true,
      lineContent: replaced,
      injectedText: `\${${envVarName}}`,
      replacedText: literal
    };
  }
});
