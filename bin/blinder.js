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

import { loadConfig } from '../src/utils/config.js';
import { maskFiles } from '../src/commands/mask.js';
import { restoreFromMasked } from '../src/commands/restore.js';
import { rollbackSecrets } from '../src/commands/rollback.js';

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
    logger.success('No secrets found!');
    return false;
  }

  // Sort: CRITICAL > HIGH > MEDIUM > LOW
  const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
  results.sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

  logger.header('Scan Results');

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
  .description('Blinder - AI-Agent Security & Secret Protection for Mobile Projects')
  .version('1.0.0')
  .option('-p, --path <path>', 'Working directory path', process.cwd())
  .option('--dry-run', 'Show what would be done without modifying files', false);

program
  .command('scan')
  .description('Scan project for sensitive information')
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

    const spinner = ora('Detecting project type...').start();
    const project = await detectProjectType(repoPath);
    spinner.succeed(`Project root: ${repoPath}`);
    spinner.succeed(`Detected platforms: ${project.platforms.join(', ') || 'None (Generic Scan)'}`);

    const scanSpinner = ora('Scanning for secrets...').start();
    const results = await scanProject(repoPath, project.platforms, {
      includeExamples: options.includeExamples,
      customPatterns: config.customPatterns,
      ignore: config.ignorePaths
    });
    scanSpinner.succeed(`Scan complete. Found ${results.length} potential secrets.`);

    await report(results, repoPath, options);
  }));

program
  .command('blind')
  .description('Complete setup (Scan + Protect + Gitignore)')
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    logger.header('Blinder - Blind Protection');
    
    if (globalOptions.dryRun) {
      logger.warn('RUNNING IN DRY-RUN MODE: No files will be modified.');
    }

    const project = await detectProjectType(repoPath);
    logger.info(`Target Platforms: ${project.platforms.join(', ')}`);
    
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
      const { choice } = await inquirer.prompt([
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

      if (choice === 'auto' || choice === 'manual') {
        await protectSecrets(repoPath, results, { 
          dryRun: globalOptions.dryRun,
          mode: choice
        });
      } else {
        logger.info('Operation skipped by user.');
      }
    }
    
    logger.header('Process Finished!');
    if (!globalOptions.dryRun) {
      logger.success('Blinder protection is now active.');
    }
  }));

program
  .command('rollback')
  .description('Undo secret protection and restore secrets back to source code')
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    await rollbackSecrets(repoPath, {
      dryRun: globalOptions.dryRun
    });
  }));

program
  .command('mask')
  .description('Create secure copies of files with masked secrets (for AI agents)')
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    await maskFiles(repoPath, { 
      maskOutput: config.maskOutput,
      customPatterns: config.customPatterns,
      ignore: config.ignorePaths
    });
  }));

program
  .command('restore [paths...]')
  .description('Apply AI agent changes from masked project back to original')
  .option('--diff', 'Show terminal diffs before applying changes', false)
  .option('--auto', 'Apply changes automatically without prompting', false)
  .action((paths) => handleAction(async () => {
    const globalOptions = program.opts();
    const commandOptions = program.commands.find(c => c.name() === 'restore').opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    await restoreFromMasked(repoPath, {
      maskOutput: config.maskOutput,
      dryRun: globalOptions.dryRun,
      paths: paths,
      diff: commandOptions.diff,
      auto: commandOptions.auto
    });
  }));

program
  .command('gitignore')
  .description('Generate platform-specific .gitignore')
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const project = await detectProjectType(repoPath);
    await generateGitignore(repoPath, project.platforms);
  }));

program.parse();
