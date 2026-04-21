import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fg from 'fast-glob';
const { glob } = fg;
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { scanProject } from '../detectors/scanner.js';
import { detectProjectType } from '../utils/detector.js';

/**
 * Masks files for AI agent context by replacing secrets in copies.
 * Now copies the entire project for full context.
 */
export async function maskFiles(repoPath, options = {}) {
  const { targetPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'targetPath',
      message: 'Enter a specific subdirectory to mask (or press Enter for the entire project):',
      default: '',
      suffix: chalk.gray(' (e.g., src/features/login)')
    }
  ]);

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

  // Exclusion patterns for full-project copy
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

  const spinner = logger.info('Indexing files and scanning for secrets...');
  
  // 1. Get all files within absoluteTarget (relative to repoPath)
  const relTarget = path.relative(repoPath, absoluteTarget) || '.';
  const allFiles = await glob(`${relTarget}/**/*`, {
    cwd: repoPath,
    ignore: excludePaths,
    dot: true,
    absolute: false
  });

  // 2. Scan for secrets
  const results = await scanProject(repoPath, project.platforms, options);
  
  // 3. Mapping data for restore command
  const mappingData = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    projectRoot: repoPath,
    mappings: {},
    fileHashes: {},
    allFiles: []
  };

  // Group secrets by file
  const secretsByFile = results.reduce((acc, s) => {
    if (!acc[s.file]) acc[s.file] = [];
    acc[s.file].push(s);
    return acc;
  }, {});

  if (!fs.existsSync(maskDir)) {
    fs.mkdirSync(maskDir, { recursive: true });
  }

  logger.info(`Masking project into ${maskDir}...`);

  for (const relPath of allFiles) {
    const srcPath = path.join(repoPath, relPath);
    const destPath = path.join(maskDir, relPath);

    // Skip directories (glob returns files usually, but being safe)
    if (fs.statSync(srcPath).isDirectory()) continue;

    const destFolder = path.dirname(destPath);
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    if (secretsByFile[relPath]) {
      // Secret masking logic
      let content = fs.readFileSync(srcPath, 'utf8');
      const secrets = secretsByFile[relPath];
      secrets.sort((a, b) => b.match.length - a.match.length);

      for (const s of secrets) {
        const mask = `__BLINDER_${s.envVarName}__`;
        content = content.split(s.match).join(mask);

        // Record mapping
        if (!mappingData.mappings[s.envVarName]) {
          mappingData.mappings[s.envVarName] = {
            originalValue: s.match,
            redactedTag: mask,
            files: []
          };
        }
        if (!mappingData.mappings[s.envVarName].files.includes(relPath)) {
          mappingData.mappings[s.envVarName].files.push(relPath);
        }
      }
      fs.writeFileSync(destPath, content);
    } else {
      // Non-secret file logic: Simple copy (handle binary vs text?)
      // For AI agents, we mostly care about text. Using copyFileSync is safer for all types.
      fs.copyFileSync(srcPath, destPath);
    }

    // Compute hash of the destination file
    const fileContent = fs.readFileSync(destPath);
    mappingData.fileHashes[relPath] = crypto.createHash('sha256').update(fileContent).digest('hex');

    mappingData.allFiles.push(relPath);
  }

  // Save mapping file
  const mapPath = path.join(maskDir, '.blinder_map.json');
  fs.writeFileSync(mapPath, JSON.stringify(mappingData, null, 2));

  logger.header('Masking Complete');
  logger.info(`Safe copy of project available in: ${maskDir}`);
  logger.success(`Secret mapping saved: ${maskDir}/.blinder_map.json`);
  logger.warn('Note: These files are for AI context. Use original files for production.');
}
