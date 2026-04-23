import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Automates Flutter .env integration by modifying IDE launch configs.
 */
export async function setupFlutterBridge(repoPath) {
  let updated = false;

  // 1. VS Code: .vscode/launch.json
  const vscodeDir = path.join(repoPath, '.vscode');
  const launchJsonPath = path.join(vscodeDir, 'launch.json');

  if (fs.existsSync(launchJsonPath)) {
    try {
      let content = fs.readFileSync(launchJsonPath, 'utf8');
      // Simple string replacement/injection for launch configurations
      // Look for configurations array and add/update args
      const defineArg = '--dart-define-from-file=.env';
      
      if (!content.includes(defineArg)) {
          // 1. If toolArgs exists, prepend to it
          if (content.includes('"toolArgs"')) {
              content = content.replace(/"toolArgs":\s*\[/g, `"toolArgs": ["${defineArg}", `);
          } 
          // 2. If args exists, prepend to it
          else if (content.includes('"args"')) {
              content = content.replace(/"args":\s*\[/g, `"args": ["${defineArg}", `);
          }
          // 3. Fallback: Add toolArgs to all configurations that look like Flutter
          else {
              content = content.replace(/"name":\s*"(.*?)"/g, `"name": "$1",\n            "toolArgs": ["${defineArg}"]`);
          }
          
          fs.writeFileSync(launchJsonPath, content);
          logger.success('VS Code launch.json updated with --dart-define-from-file');
          updated = true;
      }
    } catch (err) {
      logger.warn('Failed to update VS Code launch.json automatically.');
    }
  }

  // 2. Android Studio / IntelliJ: .idea/runConfigurations/
  const ideaDir = path.join(repoPath, '.idea', 'runConfigurations');
  if (fs.existsSync(ideaDir)) {
      const files = fs.readdirSync(ideaDir).filter(f => f.endsWith('.xml'));
      for (const file of files) {
          const absPath = path.join(ideaDir, file);
          let content = fs.readFileSync(absPath, 'utf8');
          if (content.includes('type="FlutterRunConfigurationType"') && !content.includes('--dart-define-from-file')) {
              // Inject into <option name="additionalArgs" value="..." />
              const arg = '--dart-define-from-file=.env';
              if (content.includes('name="additionalArgs"')) {
                  content = content.replace(/name="additionalArgs" value="(.*?)"/, `name="additionalArgs" value="$1 ${arg}"`);
              } else {
                  content = content.replace('</configuration>', `  <option name="additionalArgs" value="${arg}" />\n  </configuration>`);
              }
              fs.writeFileSync(absPath, content);
              logger.success(`IntelliJ run config ${file} updated.`);
              updated = true;
          }
      }
  }

  if (!updated) {
    logger.info('No IDE configurations found to automate Flutter .env loading.');
  } else {
    logger.success('Flutter .env automation applied to IDE configurations.');
  }

  // 3. Command Line Wrapper: f.sh
  const wrapperPath = path.join(repoPath, 'f.sh');
  const wrapperContent = `#!/bin/bash
# Blinder Flutter CLI Wrapper
# Usage: ./f.sh run, ./f.sh build apk, etc.
flutter "$@" --dart-define-from-file=.env
`;

  try {
    fs.writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });
    logger.success('Flutter CLI wrapper generated: f.sh');
    updated = true;
  } catch (err) {
    logger.warn('Failed to create f.sh wrapper.');
  }

  if (updated) {
    logger.info('Manual Tip: Use "./f.sh run" to ensure .env is loaded in terminal.');
  }
}
