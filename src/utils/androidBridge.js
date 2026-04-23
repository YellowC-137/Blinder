import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import fg from 'fast-glob';

const { glob } = fg;

const GROOVY_BRIDGE = `
// [Blinder Start] Auto-generated bridge to load .env into BuildConfig
def loadDotenv = {
    def envFile = rootProject.file(".env")
    if (envFile.exists()) {
        envFile.eachLine { line ->
            def matcher = (line =~ /^\\s*([\\w.-]+)\\s*=\\s*(.*)?\\s*$/)
            if (matcher.find()) {
                def key = matcher.group(1)
                def value = matcher.group(2)
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

const KTS_BRIDGE = `
// [Blinder Start] Auto-generated bridge to load .env into BuildConfig
fun Any.loadDotenv() {
    val envFile = project.rootProject.file(".env")
    if (envFile.exists()) {
        envFile.forEachLine { line ->
            val match = Regex("^\\\\s*([\\\\w.-]+)\\\\s*=\\\\s*(.*)?\\\\s*$").find(line)
            if (match != null) {
                val key = match.groupValues[1]
                var value = match.groupValues[2]
                if (value.startsWith("\\"") && value.endsWith("\\"")) value = value.substring(1, value.length - 1)
                else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1)
                
                val project = this as? com.android.build.api.variant.VariantDimension ?: return@forEachLine
                project.buildConfigField("String", key, "\\\"\$value\\\"")
                project.manifestPlaceholders[key] = value
            }
        }
    }
}
// [Blinder End]
`;

export async function setupAndroidBridge(repoPath) {
  const gradleFiles = await glob(['**/app/build.gradle', '**/app/build.gradle.kts'], { 
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/build/**']
  });

  if (gradleFiles.length === 0) {
    logger.warn('No Android app build.gradle found. Skipping Android bridge.');
    return;
  }

  for (const relPath of gradleFiles) {
    const absPath = path.join(repoPath, relPath);
    let content = fs.readFileSync(absPath, 'utf8');

    if (content.includes('[Blinder Start]')) {
      logger.info(`Bridge already exists in ${relPath}. Updating...`);
      // Update logic could be added here if bridge template changes
      continue;
    }

    const isKts = absPath.endsWith('.kts');
    const bridgeCode = isKts ? KTS_BRIDGE : GROOVY_BRIDGE;
    
    // Inject at the top of the file (safest for functions)
    content = bridgeCode + '\n' + content;

    // 1. Call the function inside android.defaultConfig
    const configPattern = /defaultConfig\s*\{/;
    if (configPattern.test(content)) {
        const callCode = isKts ? '\n        loadDotenv()' : '\n        loadDotenv()';
        content = content.replace(configPattern, `defaultConfig {${callCode}`);
        
        // 2. Ensure buildConfig is enabled (AGP 8.0+)
        // We look for buildFeatures block within android { ... }
        if (!content.includes('buildConfig = true') && !content.includes('buildConfig true')) {
            const buildFeaturesPattern = /buildFeatures\s*\{/;
            if (buildFeaturesPattern.test(content)) {
                const setting = isKts ? '\n        buildConfig = true' : '\n        buildConfig true';
                content = content.replace(buildFeaturesPattern, `buildFeatures {${setting}`);
            } else {
                // If buildFeatures block doesn't exist, create it inside android block
                const androidBlock = /android\s*\{/;
                const featuresBlock = isKts ? 
                    '\n    buildFeatures {\n        buildConfig = true\n    }' :
                    '\n    buildFeatures {\n        buildConfig true\n    }';
                content = content.replace(androidBlock, `android {${featuresBlock}`);
            }
        }

        fs.writeFileSync(absPath, content);
        logger.success(`Android bridge injected into ${relPath}`);
        
        // 3. Inform about Proguard/R8 if necessary
        logger.info('   Note: If using Proguard/R8, ensure BuildConfig is not obfuscated if you read it via reflection.');
    } else {
        logger.error(`Could not find defaultConfig block in ${relPath}. Manual setup required.`);
    }
  }
}
