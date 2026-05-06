#!/usr/bin/env -S node --no-wasm-tier-up

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
import { rollbackSecrets } from '../src/commands/rollback.js';

import { loadConfig } from '../src/utils/config.js';
import { maskFiles } from '../src/commands/mask.js';
import { restoreFromMasked } from '../src/commands/restore.js';
import { addPlatform } from '../src/commands/add_platform.js';
import { t } from '../src/utils/i18n.js';
import { getGlobalConfig, saveGlobalConfig, isLanguageConfigured } from '../src/utils/globalConfig.js';

/**
 * First-run gate: when ~/.blinder/config.json does not exist, prompt the user
 * to choose a language before any other CLI output. Skipped for set_language
 * (the user is already configuring it explicitly), help/help-flag, and any
 * non-interactive invocation (--yes / no TTY) so CI is not blocked.
 */
async function ensureLanguageOnFirstRun(argv) {
  if (isLanguageConfigured()) return;

  const yesFlag = argv.includes('-y') || argv.includes('--yes');
  const skipCmds = ['set_language', 'help', '--help', '-h', '--version', '-V'];
  if (skipCmds.some(c => argv.includes(c))) return;
  if (yesFlag || !process.stdin.isTTY) {
    saveGlobalConfig({ language: 'en' });
    return;
  }

  console.log('\n👋 Welcome to Blinder / Blinder에 오신 것을 환영합니다');
  const { language } = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: 'Choose your language / 사용할 언어를 선택하세요',
      choices: [
        { name: '1. English', value: 'en' },
        { name: '2. 한국어', value: 'ko' }
      ],
      default: 'en'
    }
  ]);
  saveGlobalConfig({ language });
  console.log(t('lang_saved', { lang: language }));
}

const program = new Command();

/**
 * Global error handler for CLI actions
 */
async function handleAction(action) {
  try {
    await action();
  } catch (error) {
    logger.error(t('error_unexpected'));
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Displays scan results and saves a report.
 * `project` is the detect result (post --platform filter); when null, falls
 * back to a fresh detect for backwards-compat with existing call sites.
 */
async function report(results, repoPath, options, skipConfirm = false, project = null) {
  const reportDir = path.join(repoPath, 'blinder_reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Ensure .gitignore is updated with platform templates
  if (!project) {
    project = applyPlatformFilter(await detectProjectType(repoPath), program.opts().platform);
  }
  await generateGitignore(repoPath, project.platforms);

  const projectName = path.basename(repoPath).toLowerCase().replace(/[^a-z0-9]/g, '_') || 'project';
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const reportFilename = `scan_result_${projectName}_${timestamp}.json`;
  const reportPath = path.join(reportDir, reportFilename);

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  logger.success(t('report_generated', { file: reportFilename }));

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
    logger.warn(t('section_sensitive_files', { count: fileWarnings.length }));
    fileWarnings.forEach(res => {
      logger.error(`  [${res.severity}] ${res.file}`);
      logger.info(`     → ${res.content}`);
    });
    logger.divider();
  }

  const liveMatches = contentMatches.filter(r => !r.isComment);
  const commentedMatches = contentMatches.filter(r => r.isComment);

  if (liveMatches.length > 0) {
    logger.info(t('section_hardcoded', { count: liveMatches.length }));
    liveMatches.forEach(res => {
      const severityPrefix = res.isTestKey ? '[TEST KEY] ' : (res.isLikelyExample ? '[EXAMPLE] ' : `[${res.severity}] `);
      logger.warn(`  ${severityPrefix}${res.file}:${res.line} - ${res.patternName}`);
      logger.info(`     Match: ${logger.maskSecret(res.match)}`);
    });
  }

  if (commentedMatches.length > 0) {
    logger.info(t('section_commented', { count: commentedMatches.length }));
    commentedMatches.forEach(res => {
      logger.warn(`  [COMMENT] ${res.file}:${res.line} - ${res.patternName}`);
      logger.info(`     Match: ${logger.maskSecret(res.match)}`);
      logger.info(`     Line:  ${res.content}`);
    });
    logger.info(t('commented_recommend_delete'));
  }

  if (options.output) {
    const customPath = path.resolve(options.output);
    fs.writeFileSync(customPath, JSON.stringify(results, null, 2));
    logger.success(`Results also exported to ${options.output}`);
  }

  // CI Mode check
  if (options.ci && results.length > 0) {
    logger.error(t('ci_secrets_found'));
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
  .option('-y, --yes', 'Automatically answer yes to all prompts (for CI)', false)
  .option('--platform <id>', 'Force a single platform plugin (e.g. node, react, springboot, java, ios, android, flutter, ruby, common). Bypasses auto-detection. React build-tool aliases (nextjs, vite, cra) resolve to react.')
  // 전역 옵션 + 환경변수 + 추천 워크플로를 --help 출력에 포함시킴.
  // 기존엔 커맨드별 help 만 있어 신규 사용자가 -p/--platform 등 글로벌 플래그
  // 존재 자체를 모르는 경우가 많았음.
  .addHelpText('after', `
환경변수 (Environment variables):
  DEBUG=1                       에러 발생 시 stack trace 출력
  BLINDER_REGRESSION_TIMEOUT=N  회귀 테스트 타임아웃(초, 기본 600)

워크플로 (Typical workflow):
  1) blinder scan              # 시크릿 탐지만
  2) blinder blind             # 탐지 + .env 분리 + 자동 치환 + bridge
  3) blinder mask              # AI 에이전트용 마스킹 디렉터리 생성
  4) blinder restore           # AI 가 수정한 마스크 디렉터리를 원본에 반영
  5) blinder rollback          # blind 결과 되돌리기

예시:
  blinder scan -p ./my-app --ci
  blinder blind --platform react --dry-run
  blinder restore --diff
`);

// React build-tool variants share the `react` plugin; the build tool is
// resolved at runtime from package.json (see detectReactBuildTool). Accepting
// the variant names as --platform aliases lets users target a React project
// without remembering that they all map to the same plugin id.
const PLATFORM_ALIASES = {
  nextjs: 'react',
  next: 'react',
  vite: 'react',
  cra: 'react'
};

/**
 * Apply --platform filter to the detect result.
 * Returns the (possibly filtered) project. Logs a warning and exits with
 * code 2 if the requested platform id was not detected in the repo.
 */
function applyPlatformFilter(project, platformId) {
  if (!platformId) return project;
  const requested = String(platformId).toLowerCase();
  const wanted = PLATFORM_ALIASES[requested] || requested;
  const matched = project.platforms.filter(p => p.id === wanted);
  if (matched.length === 0) {
    const available = project.platforms.map(p => p.id).join(', ') || '(none)';
    const aliasNote = wanted !== requested ? ` (alias for "${wanted}")` : '';
    logger.error(`--platform "${requested}"${aliasNote} not detected in this project. Detected: ${available}`);
    process.exit(2);
  }
  // Always keep `common` for cross-platform .env / .json scanning unless the
  // user explicitly asked for it. Filtering it out would silently lose env
  // file detection — surprising and rarely intended.
  const common = project.platforms.find(p => p.id === 'common');
  const filtered = (common && wanted !== 'common') ? [common, ...matched] : matched;
  return { ...project, platforms: filtered };
}

program
  .command('scan')
  .description(t('scan_desc'))
  .option('-o, --output <file>', 'Save scan results to a JSON file')
  .option('--include-examples', 'Include matches found in test/example files', false)
  .option('--scan-comments', 'Also scan secrets inside commented-out code', false)
  .option('--ci', 'Fail with exit code 1 if secrets are found', false)
  .action((options) => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Directory not found: ${repoPath}`);
    }

    const spinner = ora(t('detecting_project')).start();
    const project = applyPlatformFilter(await detectProjectType(repoPath), globalOptions.platform);
    spinner.succeed(`${t('project_root')} ${repoPath}`);
    const platformNames = project.platforms.map(p => p.name).join(', ');
    spinner.succeed(`${t('detected_platforms')} ${platformNames || 'None (Generic Scan)'}`);

    const scanSpinner = ora(t('scanning_secrets')).start();
    const results = await scanProject(repoPath, project.platforms, {
      includeExamples: options.includeExamples,
      customPatterns: config.customPatterns,
      ignore: config.ignorePaths,
      scanComments: options.scanComments
    });
    scanSpinner.succeed(t('scan_complete', { count: results.length }));

    await report(results, repoPath, options, false, project);
  }));

program
  .command('blind')
  .description(t('blind_desc'))
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const config = loadConfig(repoPath);
    logger.header(t('rerunning_blind'));

    if (globalOptions.dryRun) {
      logger.warn(t('dryrun_warn'));
    }

    const project = applyPlatformFilter(await detectProjectType(repoPath), globalOptions.platform);
    const platformNames = project.platforms.map(p => p.name).join(', ');
    logger.info(t('target_platforms', { names: platformNames }));

    if (!globalOptions.dryRun) {
      await generateGitignore(repoPath, project.platforms);
    }

    let scanComments = globalOptions.yes ? false : null;
    if (scanComments === null) {
      const response = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'scanComments',
          message: t('prompt_scan_comments'),
          default: false
        }
      ]);
      scanComments = response.scanComments;
    }

    const scanSpinner = ora(t('scanning_secrets')).start();
    const results = await scanProject(repoPath, project.platforms, {
      customPatterns: config.customPatterns,
      ignore: config.ignorePaths,
      scanComments
    });
    scanSpinner.succeed(t('scan_complete', { count: results.length }));

    const hasSecrets = await report(results, repoPath, {}, false, project);

    if (hasSecrets) {
      logger.info(`\n${t('tips')}`);
      logger.divider();
      logger.warn(t('caution_build_modify'));
      logger.info(t('caution_build_detail'));
      logger.warn(t('caution_commit_first'));
      logger.divider();

      let confirmSafety = globalOptions.yes;
      if (!confirmSafety) {
        const response = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmSafety',
            message: t('prompt_committed'),
            default: false
          }
        ]);
        confirmSafety = response.confirmSafety;
      }

      if (!confirmSafety) {
        logger.info(t('cancel_for_safety'));
        return;
      }

      // --- File Review & Interactive Ignore Phase ---
      let currentResults = results;
      const uniqueFiles = [...new Set(currentResults.map(r => r.file))];
      logger.info(t('files_for_autofix', { files: uniqueFiles.map(f => `  - ${f}`).join('\n') }));

      let additionalIgnores = '';
      if (!globalOptions.yes) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'additionalIgnores',
            message: t('prompt_exclude_dirs_blind'),
            default: ''
          }
        ]);
        additionalIgnores = response.additionalIgnores;
      }

      if (additionalIgnores.trim()) {
        const ignoreList = additionalIgnores.split(',').map(p => p.trim());
        logger.info(t('applying_filters', { filters: ignoreList.join(', ') }));

        const scanSpinner = ora(t('rescanning')).start();
        currentResults = await scanProject(repoPath, project.platforms, {
          customPatterns: config.customPatterns,
          ignore: [...(config.ignorePaths || []), ...ignoreList],
          scanComments
        });
        scanSpinner.succeed(t('scan_updated', { count: currentResults.length }));

        if (currentResults.length === 0) {
          logger.info(t('no_remaining_after_filter'));
          return;
        }
      }

      let choice = globalOptions.yes ? 'auto' : null;
      if (!choice) {
        const response = await inquirer.prompt([
          {
            type: 'rawlist',
            name: 'choice',
            message: t('prompt_choose_proceed'),
            choices: [
              { name: t('choice_auto'), value: 'auto' },
              { name: t('choice_manual'), value: 'manual' },
              { name: t('choice_exit'), value: 'exit' }
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
        logger.info(t('user_skipped'));
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
            message: t('prompt_run_bridge'),
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
    const project = applyPlatformFilter(await detectProjectType(repoPath), globalOptions.platform);
    await bridgeProject(repoPath, { dryRun: globalOptions.dryRun, platforms: project.platforms });
  }));

program
  .command('rollback')
  .description(t('rollback_desc'))
  .action(() => handleAction(async () => {
    const globalOptions = program.opts();
    const repoPath = path.resolve(globalOptions.path);
    const project = applyPlatformFilter(await detectProjectType(repoPath), globalOptions.platform);
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
    logger.info(t('mask_tip_settings'));
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
    const project = applyPlatformFilter(await detectProjectType(repoPath), globalOptions.platform);
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

await ensureLanguageOnFirstRun(process.argv);
program.parse();
