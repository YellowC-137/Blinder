import chalk from 'chalk';
import type { Logger } from '../platforms/types.js';

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
  }
};

export default logger;
