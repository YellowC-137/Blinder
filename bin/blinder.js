#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import inquirer from 'inquirer';
import logger from '../src/utils/logger.js';
import { detectProjectType } from '../src/utils/detector.js';
import { scanProject } from '../src/detectors/scanner.js';
import { generateGitignore } from '../src/commands/gitignore.js';
import { protectSecrets } from '../src/commands/protect.js';

const program = new Command();

program
  .name('blinder')
  .description('Blinder - Automated security tool for iOS, Android, and Flutter projects')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan project for sensitive information')
  .action(async () => {
    const spinner = ora('Detecting project type...').start();
    const repoPath = process.cwd();
    const project = await detectProjectType(repoPath);
    spinner.succeed(`Detected platforms: ${project.platforms.join(', ') || 'None (Generic Scan)'}`);

    const scanSpinner = ora('Scanning for secrets...').start();
    const results = await scanProject(repoPath, project.platforms);
    scanSpinner.succeed(`Scan complete. Found ${results.length} potential secrets.`);

    if (results.length > 0) {
      logger.header('Scan Results');
      results.forEach(res => {
        logger.warn(`[${res.severity}] ${res.file}:${res.line} - ${res.patternName}`);
        logger.info(`   Match: ${res.match}`);
      });

      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Would you like to proceed with secret protection (Auto-fix or Manual)?',
          default: true
        }
      ]);

      if (proceed) {
        await protectSecrets(repoPath, results);
      }
    } else {
      logger.success('No secrets found!');
    }
  });

program
  .command('gitignore')
  .description('Generate platform-specific .gitignore')
  .action(async () => {
    const repoPath = process.cwd();
    const project = await detectProjectType(repoPath);
    await generateGitignore(repoPath, project.platforms);
  });

program
  .command('protect')
  .description('Extract secrets to .env and protect codebase')
  .action(async () => {
    const repoPath = process.cwd();
    const project = await detectProjectType(repoPath);
    const results = await scanProject(repoPath, project.platforms);
    await protectSecrets(repoPath, results);
  });

program
  .command('init')
  .description('Complete setup (Scan + Protect + Gitignore)')
  .action(async () => {
    logger.header('Blinder Initialization');
    const repoPath = process.cwd();
    const project = await detectProjectType(repoPath);
    
    logger.info(`Target Platforms: ${project.platforms.join(', ')}`);
    
    await generateGitignore(repoPath, project.platforms);
    const results = await scanProject(repoPath, project.platforms);
    await protectSecrets(repoPath, results);
    
    logger.header('Setup Complete!');
    logger.success('Your project is now more secure.');
  });

program.parse();
