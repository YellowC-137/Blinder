import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fg from 'fast-glob';
const { glob } = fg;
import logger from '../utils/logger.js';
import { scanProject } from '../detectors/scanner.js';
import { detectProjectType } from '../utils/detector.js';
import { performMasking } from '../services/maskingService.js';

export async function maskFiles(repoPath, options = {}) {
  let targetPath = '';
  if (!options.yes) {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'targetPath',
        message: 'Enter a specific subdirectory to mask (or press Enter for the entire project):',
        default: '',
        suffix: chalk.gray(' (e.g., src/features/login)')
      }
    ]);
    targetPath = response.targetPath;
  }

  const absoluteTarget = targetPath ? path.resolve(repoPath, targetPath) : repoPath;
  if (!fs.existsSync(absoluteTarget)) {
    logger.error(`Path not found: ${absoluteTarget}`);
    return;
  }

  const project = await detectProjectType(repoPath);
  const projectName = path.basename(repoPath);
  const defaultMaskOutput = `maskedProject_${projectName}`;
  const maskDir = path.join(repoPath, options.maskOutput || defaultMaskOutput);
  const maskOutputDirName = options.maskOutput || defaultMaskOutput;

  const excludePaths = [
    'node_modules/**',
    '.git/**',
    `${maskOutputDirName}/**`,
    'blinder_reports/**',
    '.env',
    '.env.example',
    '.blinder_map.json',
    'Pods/**',
    'build/**',
    'dist/**',
    '.dart_tool/**',
    '.gradle/**',
    '**/*.jks',
    '**/*.keystore',
    '**/*.p12',
    '**/*.mobileprovision',
    '**/*Tests/**',
    '**/*Test/**',
    '**/*.xctest/**',
    '**/test/**',
    '**/androidTest/**',
    ...(options.ignore || [])
  ];

  logger.info('Indexing files and scanning for secrets...');
  
  const relTarget = path.relative(repoPath, absoluteTarget) || '.';
  const allFiles = await glob(`${relTarget}/**/*`, {
    cwd: repoPath,
    ignore: excludePaths,
    dot: true,
    absolute: false
  });

  const results = await scanProject(repoPath, project.platforms, options);
  
  logger.info(`Masking project into ${maskDir}...`);
  await performMasking(repoPath, allFiles, results, maskDir, options);

  logger.header('Masking Complete');
  logger.info(`Safe copy of project available in: ${maskDir}`);
  logger.success(`Secret mapping saved: ${maskDir}/.blinder_map.json`);
  logger.warn('Note: These files are for AI context. Use original files for production.');
}
