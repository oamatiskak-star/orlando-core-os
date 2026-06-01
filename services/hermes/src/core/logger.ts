import pino from 'pino';
import { loadConfig } from './config.js';

const cfg = loadConfig();

export const logger = pino({
  level: cfg.HERMES_LOG_LEVEL,
  base: { service: 'hermes', env: cfg.HERMES_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'SUPABASE_SERVICE_ROLE_KEY',
      'WHATSAPP_CLOUD_API_TOKEN',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_APP_SECRET',
      '*.token',
      '*.secret',
      'headers.authorization',
    ],
    censor: '[redacted]',
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
