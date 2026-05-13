import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, worker, ...meta }) => {
          const prefix = worker ? `[${worker}]` : '[planner]'
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
          return `${timestamp} ${level} ${prefix} ${message}${extra}`
        })
      ),
    }),
  ],
})

export function workerLogger(name: string) {
  return logger.child({ worker: name })
}
