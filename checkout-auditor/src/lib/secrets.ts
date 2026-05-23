import { z } from 'zod'
import 'dotenv/config'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().positive().default(3008),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default('checkout-audit-artifacts'),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL_PRIMARY: z.string().default('claude-opus-4-7'),
  ANTHROPIC_MODEL_BATCH: z.string().default('claude-sonnet-4-6'),

  STRIPE_RESTRICTED_KEY_TEST: z.string().optional(),

  AQUIER_BASE_URL: z.string().url().default('https://aquier.com'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  CHECKOUT_AUDITOR_MAX_SCENARIOS_PER_RUN: z.coerce.number().int().positive().default(20),
  BROWSER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  SKIP_WEBKIT_DEVICES: z.coerce.boolean().default(false),
  SCENARIO_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  WEBHOOK_WAIT_MAX_MS: z.coerce.number().int().positive().default(60_000),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(14),

  RUN_TRIGGER_SECRET: z.string().optional(),
  AGENT_TIMEZONE: z.string().default('Europe/Amsterdam'),
})

export type Env = z.infer<typeof EnvSchema>

export const env: Env = EnvSchema.parse(process.env)

export function hasStripeKey(): boolean {
  return !!env.STRIPE_RESTRICTED_KEY_TEST && env.STRIPE_RESTRICTED_KEY_TEST.startsWith('rk_')
}
