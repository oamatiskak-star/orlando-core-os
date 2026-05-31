import 'dotenv/config'
import { logger } from './core/logger'
import { boot } from './core/boot'

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection')
})

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception')
  process.exit(1)
})

boot().catch((err) => {
  logger.fatal({ err }, 'Boot failed')
  process.exit(1)
})
