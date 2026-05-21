import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { t } from './i18n.js';

interface LaunchConfig {
  toolArgs?: string[];
  args?: string[];
  [key: string]: unknown;
}

interface LaunchJson {
  configurations?: LaunchConfig[];
  [key: string]: unknown;
}

/**
 * Automates Flutter .env integration by modifying IDE launch configs.
 */
export async function setupFlutterBridge(repoPath: string): Promise<void> {
  let updated: boolean = false;

  // 1. VS Code: .vscode/launch.json
  const vscodeDir: string = path.join(repoPath, '.vscode');
  const launchJsonPath: string = path.join(vscodeDir, 'launch.json');

  if (fs.existsSync(launchJsonPath)) {
    try {
      let content: string = fs.readFileSync(launchJsonPath, 'utf8');
      // Simple string replacement/injection for launch configurations
      // Look for configurations array and add/update args
      const defineArg: string = '--dart-define-from-file=.env';
      
      if (!content.includes(defineArg)) {
          // 1. If toolArgs exists, prepend to it
          if (content.includes('"toolArgs"')) {
              content = content.replace(/"toolArgs":\s*\[/g, `"toolArgs": ["${defineArg}", `);
          } 
          // 2. If args exists, prepend to it
          else if (content.includes('"args"')) {
              content = content.replace(/"args":\s*\[/g, `"args": ["${defineArg}", `);
          }
          // 3. Fallback: Parse JSON, inject toolArgs safely into each configuration
          else {
              try {
                const parsed: LaunchJson = JSON.parse(content) as LaunchJson;
                if (parsed.configurations && Array.isArray(parsed.configurations)) {
                  for (const cfg of parsed.configurations) {
                    if (!cfg.toolArgs) cfg.toolArgs = [];
                    if (!cfg.toolArgs.includes(defineArg)) cfg.toolArgs.unshift(defineArg);
                  }
                  content = JSON.stringify(parsed, null, 4);
                }
              } catch {
                // If JSON parse fails, skip modification to avoid corruption
                logger.warn(t('flutter_vscode_update_failed'));
              }
          }
          
          fs.writeFileSync(launchJsonPath, content);
          logger.success(t('flutter_vscode_updated'));
          updated = true;
      }
    } catch (err: unknown) {
      logger.warn(t('flutter_vscode_update_failed'));
    }
  }

  // 2. Android Studio / IntelliJ: .idea/runConfigurations/
  const ideaDir: string = path.join(repoPath, '.idea', 'runConfigurations');
  if (fs.existsSync(ideaDir)) {
      const files: string[] = fs.readdirSync(ideaDir).filter((f: string) => f.endsWith('.xml'));
      for (const file of files) {
          const absPath: string = path.join(ideaDir, file);
          let content: string = fs.readFileSync(absPath, 'utf8');
          if (content.includes('type="FlutterRunConfigurationType"') && !content.includes('--dart-define-from-file')) {
              // Inject into <option name="additionalArgs" value="..." />
              const arg: string = '--dart-define-from-file=.env';
              if (content.includes('name="additionalArgs"')) {
                  // Use function form to prevent backreference injection from captured group
                  content = content.replace(/name="additionalArgs" value="(.*?)"/, (_: string, existing: string) => `name="additionalArgs" value="${existing} ${arg}"`);
              } else {
                  content = content.replace('</configuration>', `  <option name="additionalArgs" value="${arg}" />\n  </configuration>`);
              }
              fs.writeFileSync(absPath, content);
              logger.success(t('flutter_intellij_updated', { file }));
              updated = true;
          }
      }
  }

  if (!updated) {
    logger.info(t('flutter_no_ide_configs'));
  } else {
    logger.success(t('flutter_ide_applied'));
  }

  // 3. Command Line Wrapper: f.sh
  const wrapperPath: string = path.join(repoPath, 'f.sh');
  const wrapperContent: string = `#!/bin/bash
# Blinder Flutter CLI Wrapper
# Usage: ./f.sh run, ./f.sh build apk, etc.
flutter "$@" --dart-define-from-file=.env
`;

  try {
    fs.writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 });
    logger.success(t('flutter_cli_wrapper_gen'));
    updated = true;
  } catch (err: unknown) {
    logger.warn(t('flutter_cli_wrapper_failed'));
  }

  if (updated) {
    logger.info(t('flutter_manual_tip'));
  }
}
