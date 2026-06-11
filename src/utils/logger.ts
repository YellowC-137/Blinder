import chalk from 'chalk';
import type { Logger, FindingOptions } from '../platforms/types.js';

const logger: Logger = {
  info: (msg: string): void => { console.log(chalk.blue('ℹ ') + msg); },
  success: (msg: string): void => { console.log(chalk.green('✔ ') + msg); },
  warn: (msg: string): void => { console.log(chalk.yellow('⚠ ') + msg); },
  error: (msg: string): void => { console.error(chalk.red('✖ ') + msg); },
  debug: (msg: string): void => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('DEBUG: ') + msg);
    }
  },
  divider: (): void => { console.log(chalk.gray('━'.repeat(50))); },
  maskSecret: (secret: string): string => {
    if (!secret || secret.length <= 6) return '********';
    if (secret.length <= 15) return secret.substring(0, 2) + '***' + secret.substring(secret.length - 2);
    return secret.substring(0, 3) + '...' + secret.substring(secret.length - 3);
  },
  header: (msg: string): void => {
    console.log('\n' + chalk.bold.cyan(msg));
    logger.divider();
  },
  /**
   * 일관된 finding 포맷 — CI 에서 grep 으로 파싱하기 쉬운 한 줄 형식.
   * 사용 예: logger.finding({ severity: 'HIGH', file: 'a.js', line: 12, patternName: 'AWS Key', match: 'AKIA...' })
   * 출력: `[HIGH] a.js:12 — AWS Key — AKIA...`
   */
  finding: ({ severity, file, line, patternName, match, masked = true }: FindingOptions): void => {
    const sev: string = `[${(severity || 'INFO').toUpperCase()}]`;
    const loc: string = line != null && line !== 0 ? `${file}:${line}` : file;
    const valuePart: string = match ? ` — ${masked ? logger.maskSecret(match) : match}` : '';
    console.log(`${sev} ${loc} — ${patternName}${valuePart}`);
  }
};

export default logger;
