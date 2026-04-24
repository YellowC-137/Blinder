#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import logger from '../src/utils/logger.js';
import { detectProjectType } from '../src/utils/detector.js';
import { scanProject } from '../src/detectors/scanner.js';
import { generateGitignore } from '../src/commands/gitignore.js';
import { protectSecrets } from '../src/commands/protect.js';
import { bridgeProject } from '../src/commands/bridge.js';

import { loadConfig } from '../src/utils/config.js';
import { maskFiles } from '../src/commands/mask.js';
import { restoreFromMasked } from '../src/commands/restore.js';
import { addPlatform } from '../src/commands/add_platform.js';
import { t } from '../src/utils/i18n.js';
import { getGlobalConfig, saveGlobalConfig } from '../src/utils/globalConfig.js';

const program = new Command();

/**
 * Global error handler for CLI actions
 */
async function handleAction(action) {
  try {
    await action();
  } catch (error) {
    logger.error('An unexpected error occurred:');
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Displays scan results and saves a report.
 */
async function report(results, repoPath, options, skipConfirm = false) {
  const reportDir = path.join(repoPath, 'blinder_reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Ensure blinder_reports/ is in .gitignore
  const gitignorePath = path.join(repoPath, '.gitignore');
  const ignoreString = 'blinder_reports/';
  let gitignoreContent = '';
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }
  if (!gitignoreContent.includes(ignoreString)) {
    fs.appendFileSync(gitignorePath, `\n# Blinder Reports\n${ignoreString}\n`);
    logger.info('Added blinder_reports/ to .gitignore');
  }

  const projectName = path.basename(repoPath).toLowerCase().replace(/[^a-z0-9]/g, '_') || 'project';
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const reportFilename = `scan_result_${projectName}_${timestamp}.json`;
  const reportPath = path.join(reportDir, reportFilename);

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  logger.success(`Automatic report generated: blinder_reports/${reportFilename}`);

  if (results.length === 0) {
    logger.success(t('no_secrets'));
    return false;
  }

  // Sort: CRITICAL > HIGH > MEDIUM > LOW
  const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
  results.sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

  logger.header(t('header_results'));

  const fileWarnings = results.filter(r => r.isSensitiveFile);
  const contentMatches = results.filter(r => !r.isSensitiveFile);

  if (fileWarnings.length > 0) {
    logger.warn(`\n🚨 Sensitive Files Detected (${fileWarnings.length}):`);
    fileWarnings.forEach(res => {
      logger.error(`  [${res.severity}] ${res.file}`);
      logger.info(`     → ${res.content}`);
    });
    logger.divider();
  }

  if (contentMatches.length > 0) {
    logger.info(`\n🔍 Hardcoded Secrets (${contentMatches.length}):`);
    contentMatches.forEach(res => {
      const severityPrefix = res.isTestKey ? '[TEST KEY] ' : (res.isLikelyExample ? '[EXAMPLE] ' : `[${res.severity}] `);
      logger.warn(`  ${severityPrefix}${res.file}:${res.line} - ${res.patternName}`);
      logger.info(`     Match: ${logger.maskSecret(res.match)}`);
    });
  }

  if (options.output) {
    const customPath = path.resolve(options.output);
    fs.writeFileSync(customPath, JSON.stringify(results, null, 2));
    logger.success(`Results also exported to ${options.output}`);
  }

  // CI Mode check
  if (options.ci && results.length > 0) {
    logger.error('Secrets found in CI mode. Terminating with status 1.');
    process.exit(1);
  }

  return results.length > 0;
}

program
  .name('blinder')
  .description(t('cli_desc'))
  .version('1.0.0')
  .option('-p, --path <path>', 'Working directory path', process.cwd())
  .option('--dry-run', 'Show what would be done without modifying files', false)
  .option('-y, --yes', 'Automatically answer yes to all prompts (for CI)', false);

program
  .command('scan')
  .description(t('scan_desc'))
  .option('-o, --output <file>', 'Save scan results to a JSON file')
  .option('--include-examples', 'Include matches found in test/example files', false)
  .option('--ci', 'Fail with exit code 1 if secrets are found', false)
  .action((options) => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Directory not found: ${repoPath}`);
    }

    const spinner = ora(t('detecting_project')).start();
    const project = await detectProjectType(repoPath);
    spinner.succeed(`${t('project_root')} ${repoPath}`);
    const platformNames = project.platforms.map(p => p.name).join(', ');
    spinner.succeed(`${t('detected_platforms')} ${platformNames || 'None (Generic Scan)'}`);

    const scanSpinner = ora(t('scanning_secrets')).start();
    const results = await scanProject(repoPath, project.platforms, {
      includeExamples: options.includeExamples,
      customPatterns: config.customPatterns,
      ignore: config.ignorePaths
    });
    scanSpinner.succeed(t('scan_complete', { count: results.length }));

    await report(results, repoPath, options);
  }));

program
  .command('blind')
  .description(t('blind_desc'))
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    logger.header('Blinder - Blind Protection');
    
    if (globalOptions.dryRun) {
      logger.warn('RUNNING IN DRY-RUN MODE: No files will be modified.');
    }

    const project = await detectProjectType(repoPath);
    const platformNames = project.platforms.map(p => p.name).join(', ');
    logger.info(`Target Platforms: ${platformNames}`);
    
    if (!globalOptions.dryRun) {
      await generateGitignore(repoPath, project.platforms);
    }

    const scanSpinner = ora('Scanning for secrets...').start();
    const results = await scanProject(repoPath, project.platforms, {
      customPatterns: config.customPatterns,
      ignore: config.ignorePaths
    });
    scanSpinner.succeed(`Scan complete. Found ${results.length} potential secrets.`);

    const hasSecrets = await report(results, repoPath, {});
    
    if (hasSecrets) {
      logger.info(`\n${t('tips')}`);
      logger.divider();
      logger.warn('⚠️  CAUTION: Build Configuration Modification');
      logger.info('   This tool may modify your project\'s core build files (build.gradle, .pbxproj, etc.)');
      logger.info('   when performing auto-fixes or environment bridging.');
      logger.warn('   Please ensure you have committed all changes to Git before proceeding.');
      logger.divider();
      
      let confirmSafety = globalOptions.yes;
      if (!confirmSafety) {
        const response = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmSafety',
            message: 'Have you committed your current changes and are you ready to proceed?',
            default: false
          }
        ]);
        confirmSafety = response.confirmSafety;
      }

      if (!confirmSafety) {
        logger.info('Operation cancelled by user for safety.');
        return;
      }

      // --- New: File Review & Interactive Ignore Phase ---
      let currentResults = results;
      const uniqueFiles = [...new Set(currentResults.map(r => r.file))];
      logger.info(`\nThe following files are targeted for Auto-fix:\n${uniqueFiles.map(f => `  - ${f}`).join('\n')}`);
      
      let additionalIgnores = '';
      if (!globalOptions.yes) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'additionalIgnores',
            message: 'Are there any folders or files you want to EXCLUDE? (Enter glob patterns separated by comma, e.g., "**/ExtLib/**, **/Temp/**", or leave empty):',
            default: ''
          }
        ]);
        additionalIgnores = response.additionalIgnores;
      }

      if (additionalIgnores.trim()) {
        const ignoreList = additionalIgnores.split(',').map(p => p.trim());
        logger.info(`Applying additional filters: ${ignoreList.join(', ')}...`);
        
        const scanSpinner = ora('Re-scanning with new filters...').start();
        currentResults = await scanProject(repoPath, project.platforms, {
          customPatterns: config.customPatterns,
          ignore: [...(config.ignorePaths || []), ...ignoreList]
        });
        scanSpinner.succeed(`Scan updated. Remaining secrets to fix: ${currentResults.length}`);
        
        if (currentResults.length === 0) {
          logger.info('No secrets remaining after filtering. Exiting.');
          return;
        }
      }
      // ----------------------------------------------------

      let choice = globalOptions.yes ? 'auto' : null;
      if (!choice) {
        const response = await inquirer.prompt([
          {
            type: 'rawlist',
            name: 'choice',
            message: 'Choose how to proceed with secret protection:',
            choices: [
              { name: 'Auto-fix (Recommended: Automatically replace secrets with environment variable calls)', value: 'auto' },
              { name: 'Manual (Generate .env but perform code migration manually)', value: 'manual' },
              { name: 'Exit (Do nothing and exit)', value: 'exit' }
            ]
          }
        ]);
        choice = response.choice;
      }

      if (choice === 'auto' || choice === 'manual') {
        await protectSecrets(repoPath, currentResults, { 
          dryRun: globalOptions.dryRun,
          mode: choice,
          platforms: project.platforms
        });
      } else {
        logger.info('Operation skipped by user.');
      }
    }
    
    logger.header(t('process_finished'));
    if (!globalOptions.dryRun) {
      logger.success(t('protection_active'));
      
      let runBridge = globalOptions.yes;
      if (!runBridge) {
        const response = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'runBridge',
            message: 'Would you like to run "blinder bridge" now to automate .env integration with native builds?',
            default: true
          }
        ]);
        runBridge = response.runBridge;
      }

      if (runBridge) {
        await bridgeProject(repoPath, { dryRun: globalOptions.dryRun, platforms: project.platforms });
      }
    }
  }));

program
  .command('bridge')
  .description(t('bridge_desc'))
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const project = await detectProjectType(repoPath);
    await bridgeProject(repoPath, { dryRun: globalOptions.dryRun, platforms: project.platforms });
  }));

program
  .command('rollback')
  .description(t('rollback_desc'))
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const project = await detectProjectType(repoPath);
    await rollbackSecrets(repoPath, { 
      dryRun: globalOptions.dryRun,
      yes: globalOptions.yes,
      platforms: project.platforms
    });
  }));

program
  .command('mask')
  .description(t('mask_desc'))
  .option('-o, --output <dir>', 'Masked output directory')
  .action((options) => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    const { maskFiles } = await import('../src/commands/mask.js');
    logger.info('\n💡 TIP: You can customize masked output paths via ".blinderSettings" file.');
    await maskFiles(repoPath, { ...options, ...globalOptions, ...config, maskOutput: options.output });
  }));

program
  .command('restore')
  .description(t('restore_desc'))
  .option('-o, --output <dir>', 'Masked output directory (auto-detected if not specified)')
  .option('--diff', 'Show diffs before applying changes', false)
  .action((options) => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const { restoreFromMasked } = await import('../src/commands/restore.js');
    await restoreFromMasked(repoPath, { 
      ...options, 
      maskOutput: options.output,
      yes: globalOptions.yes,
      dryRun: globalOptions.dryRun 
    });
  }));

program
  .command('gitignore')
  .description(t('gitignore_desc'))
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const project = await detectProjectType(repoPath);
    await generateGitignore(repoPath, project.platforms);
  }));

program
  .command('add_platform')
  .description(t('add_platform_desc'))
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    await addPlatform(repoPath);
  }));

program
  .command('set_language')
  .description(t('set_language_desc'))
  .argument('<lang>', 'Language (ko/en)')
  .action((lang) => handleAction(async () => {
    if (!['ko', 'en'].includes(lang)) {
      throw new Error('Support only "ko" or "en"');
    }
    saveGlobalConfig({ language: lang });
    logger.success(t('lang_changed', { lang }));
  }));

program
  .command('help')
  .description('Display help information for all commands')
  .action(() => {
    program.help();
  });

program.parse();
