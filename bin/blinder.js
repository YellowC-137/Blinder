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

program
  .name('blinder')
  .description('Blinder - Automated security tool for iOS, Android, and Flutter projects')
  .version('1.0.0')
  .option('-p, --path <path>', 'Working directory path', process.cwd())
  .option('--dry-run', 'Show what would be done without modifying files', false);

program
  .command('scan')
  .description('Scan project for sensitive information')
  .option('-o, --output <file>', 'Save scan results to a JSON file')
  .option('--include-examples', 'Include matches found in test/example files', false)
  .action((options) => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Directory not found: ${repoPath}`);
    }

    const spinner = ora('Detecting project type...').start();
    const project = await detectProjectType(repoPath);
    spinner.succeed(`Project root: ${repoPath}`);
    spinner.succeed(`Detected platforms: ${project.platforms.join(', ') || 'None (Generic Scan)'}`);

    const scanSpinner = ora('Scanning for secrets...').start();
    const results = await scanProject(repoPath, project.platforms, {
      includeExamples: options.includeExamples
    });
    scanSpinner.succeed(`Scan complete. Found ${results.length} potential secrets.`);

    if (results.length > 0) {
      // Sort: CRITICAL > HIGH > MEDIUM > LOW
      const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
      results.sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

      logger.header('Scan Results');
      results.forEach(res => {
        const severityPrefix = res.isTestKey ? '[TEST KEY] ' : (res.isLikelyExample ? '[EXAMPLE] ' : `[${res.severity}] `);
        logger.warn(`${severityPrefix}${res.file}:${res.line} - ${res.patternName}`);
        logger.info(`   Match: ${logger.maskSecret(res.match)}`);
      });

      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        logger.success(`Results exported to ${options.output}`);
      }

      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Would you like to proceed with secret protection (Auto-fix or Manual)?',
          default: true
        }
      ]);

      if (proceed) {
        await protectSecrets(repoPath, results, { dryRun: globalOptions.dryRun });
      }
    } else {
      logger.success('No secrets found!');
    }
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

program
  .command('protect')
  .description('Extract secrets to .env and protect codebase')
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const project = await detectProjectType(repoPath);
    const results = await scanProject(repoPath, project.platforms);
    await protectSecrets(repoPath, results, { dryRun: globalOptions.dryRun });
  }));

program
  .command('init')
  .description('Complete setup (Scan + Protect + Gitignore)')
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    logger.header('Blinder Initialization');
    
    if (globalOptions.dryRun) {
      logger.warn('RUNNING IN DRY-RUN MODE: No files will be modified.');
    }

    const project = await detectProjectType(repoPath);
    logger.info(`Target Platforms: ${project.platforms.join(', ')}`);
    
    if (!globalOptions.dryRun) {
      await generateGitignore(repoPath, project.platforms);
    } else {
      logger.info('[Dry-Run] Would generate/update .gitignore');
    }

    const results = await scanProject(repoPath, project.platforms);
    await protectSecrets(repoPath, results, { dryRun: globalOptions.dryRun });
    
    logger.header('Process Finished!');
    if (!globalOptions.dryRun) {
      logger.success('Your project is now more secure.');
    }
  }));

program.parse();
