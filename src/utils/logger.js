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
  header: (msg) => {
    console.log('\n' + chalk.bold.cyan(msg));
    logger.divider();
  }
};

export default logger;
