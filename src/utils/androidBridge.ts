import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import fg from 'fast-glob';
import { t } from './i18n.js';

const { glob } = fg;

const GROOVY_BRIDGE: string = `
// [Blinder Start] Auto-generated bridge to load .env into BuildConfig
def loadDotenv = {
    def envFile = rootProject.file(".env")
    if (envFile.exists()) {
        envFile.eachLine { line ->
            def matcher = (line =~ /^\\s*([\\w.-]+)\\s*=\\s*([^\\n]*)$/)
            if (matcher.find()) {
                def key = matcher.group(1)
                def value = (matcher.group(2) ?: '').trim()
                if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length() - 1)
                else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length() - 1)
                buildConfigField "String", key, "\\"\${value}\\""
                manifestPlaceholders += [ (key): value ]
            }
        }
    }
}
// [Blinder End]
`;

const KTS_BRIDGE: string = `
// [Blinder Start] Auto-generated bridge to load .env into BuildConfig
fun Any.loadDotenv() {
    val envFile = project.rootProject.file(".env")
    if (envFile.exists()) {
        envFile.forEachLine { line ->
            val match = Regex("^\\\\s*([\\\\w.-]+)\\\\s*=\\\\s*([^\\\\n]*)$").find(line)
            if (match != null) {
                val key = match.groupValues[1]
                var value = match.groupValues[2]
                if (value.startsWith("\\"") && value.endsWith("\\"")) value = value.substring(1, value.length - 1)
                else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1)
                
                val project = this as? com.android.build.api.variant.VariantDimension
                if (project == null) { println("Blinder: Skipping .env line (cast failed): \$key"); return@forEachLine }
                project.buildConfigField("String", key, "\\\"\$value\\\"")
                project.manifestPlaceholders[key] = value
            }
        }
    }
}
// [Blinder End]
`;

export async function setupAndroidBridge(repoPath: string): Promise<void> {
  const gradleFiles: string[] = await glob(['**/app/build.gradle', '**/app/build.gradle.kts'], { 
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/build/**']
  });

  if (gradleFiles.length === 0) {
    logger.warn(t('android_no_gradle'));
    return;
  }

  for (const relPath of gradleFiles) {
    const absPath: string = path.join(repoPath, relPath);
    let content: string = fs.readFileSync(absPath, 'utf8');

    if (content.includes('[Blinder Start]')) {
      logger.info(t('android_bridge_exists', { relPath }));
      // Update logic could be added here if bridge template changes
      continue;
    }

    const isKts: boolean = absPath.endsWith('.kts');
    const bridgeCode: string = isKts ? KTS_BRIDGE : GROOVY_BRIDGE;
    
    // Inject at the top of the file (safest for functions)
    content = bridgeCode + '\n' + content;

    // 1. Call the function inside android.defaultConfig
    const configPattern: RegExp = /defaultConfig\s*\{/;
    if (configPattern.test(content)) {
        const callCode: string = isKts ? '\n        loadDotenv()' : '\n        loadDotenv()';
        content = content.replace(configPattern, `defaultConfig {${callCode}`);
        
        // 2. Ensure buildConfig is enabled (AGP 8.0+)
        // We look for buildFeatures block within android { ... }
        if (!content.includes('buildConfig = true') && !content.includes('buildConfig true')) {
            const buildFeaturesPattern: RegExp = /buildFeatures\s*\{/;
            if (buildFeaturesPattern.test(content)) {
                const setting: string = isKts ? '\n        buildConfig = true' : '\n        buildConfig true';
                content = content.replace(buildFeaturesPattern, `buildFeatures {${setting}`);
            } else {
                // If buildFeatures block doesn't exist, create it inside android block
                const androidBlock: RegExp = /android\s*\{/;
                const featuresBlock: string = isKts ? 
                    '\n    buildFeatures {\n        buildConfig = true\n    }' :
                    '\n    buildFeatures {\n        buildConfig true\n    }';
                content = content.replace(androidBlock, `android {${featuresBlock}`);
            }
        }

        fs.writeFileSync(absPath, content);
        logger.success(t('android_bridge_success', { relPath }));
        
        // 3. Inform about Proguard/R8 if necessary
        logger.info(t('android_proguard_note'));
    } else {
        logger.error(t('android_bridge_no_config', { relPath }));
    }
  }
}
