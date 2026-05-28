import { z } from 'zod';

const envSchema = z.object({
  HERMES_PORT: z.coerce.number().int().positive().default(8787),
  HERMES_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  HERMES_ENV: z.enum(['local', 'staging', 'production']).default('local'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  WHATSAPP_CLOUD_API_TOKEN: z.string().min(20).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(5).optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(10).optional(),
  WHATSAPP_APP_SECRET: z.string().min(10).optional(),
});

export type HermesConfig = z.infer<typeof envSchema>;

let cached: HermesConfig | null = null;

export function loadConfig(): HermesConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid Hermes environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function whatsappEnabled(cfg: HermesConfig): boolean {
  return Boolean(
    cfg.WHATSAPP_CLOUD_API_TOKEN &&
      cfg.WHATSAPP_PHONE_NUMBER_ID &&
      cfg.WHATSAPP_VERIFY_TOKEN &&
      cfg.WHATSAPP_APP_SECRET,
  );
}
