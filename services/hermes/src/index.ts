import { boot } from './core/boot.js';
import { logger } from './core/logger.js';

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});

boot().catch((err) => {
  logger.fatal({ err }, 'boot failed');
  process.exit(1);
});
