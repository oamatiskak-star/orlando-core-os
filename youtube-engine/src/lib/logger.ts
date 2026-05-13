import winston from 'winston'
import path from 'path'
import fs from 'fs'

const LOG_DIR = process.env.LOG_DIR ?? 'logs'

if (process.env.LOG_TO_FILE === 'true' && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, worker, videoId, ...meta }) => {
        const prefix = worker ? `[${worker}]` : ''
        const vid = videoId ? ` vid=${videoId}` : ''
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
        return `${timestamp} ${level} ${prefix}${vid} ${message}${extra}`
      })
    ),
  }),
]

if (process.env.LOG_TO_FILE === 'true') {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    })
  )
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  transports,
})

export function workerLogger(workerName: string) {
  return logger.child({ worker: workerName })
}
