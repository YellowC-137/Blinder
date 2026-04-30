import chalk from 'chalk';

const logger = {
  info: (msg) => console.log(chalk.blue('ℹ ') + msg),
  success: (msg) => console.log(chalk.green('✔ ') + msg),
  warn: (msg) => console.log(chalk.yellow('⚠ ') + msg),
  error: (msg) => console.error(chalk.red('✖ ') + msg),
  debug: (msg) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('DEBUG: ') + msg);
    }
  },
  divider: () => console.log(chalk.gray('━'.repeat(50))),
  maskSecret: (secret) => {
    if (!secret || secret.length < 8) return '********';
    return secret.substring(0, 4) + '...' + secret.substring(secret.length - 4);
  },
  header: (msg) => {
    console.log('\n' + chalk.bold.cyan(msg));
    logger.divider();
  },
  /**
   * 일관된 finding 포맷 — CI 에서 grep 으로 파싱하기 쉬운 한 줄 형식.
   * 사용 예: logger.finding({ severity: 'HIGH', file: 'a.js', line: 12, patternName: 'AWS Key', match: 'AKIA...' })
   * 출력: `[HIGH] a.js:12 — AWS Key — AKIA...`
   */
  finding: ({ severity, file, line, patternName, match, masked = true }) => {
    const sev = `[${(severity || 'INFO').toUpperCase()}]`;
    const loc = line != null && line !== 0 ? `${file}:${line}` : file;
    const valuePart = match ? ` — ${masked ? logger.maskSecret(match) : match}` : '';
    console.log(`${sev} ${loc} — ${patternName}${valuePart}`);
  }
};

export default logger;
