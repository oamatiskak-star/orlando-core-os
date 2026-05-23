import pino from 'pino'
import { env } from './secrets'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'checkout-auditor' },
  formatters: {
    level(label) {
      return { level: label }
    },
  },
})

export type Logger = typeof logger
