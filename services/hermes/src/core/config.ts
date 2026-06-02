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

  // Telegram-escalatiebridge (gratis alternatief voor Meta WhatsApp).
  TELEGRAM_BOT_TOKEN: z.string().min(20).optional(),
  // Secret-token dat Telegram als header X-Telegram-Bot-Api-Secret-Token meestuurt
  // (ingesteld bij setWebhook). Verplicht om de webhook te accepteren.
  TELEGRAM_WEBHOOK_SECRET: z.string().min(10).optional(),
  // Welk kanaal escalaties verstuurt. Leeg = auto: telegram als TELEGRAM_BOT_TOKEN
  // gezet is, anders whatsapp. 'both' draait beide bridges naast elkaar.
  HERMES_ESCALATION_CHANNEL: z.enum(['whatsapp', 'telegram', 'both']).optional(),
});

export type HermesConfig = z.infer<typeof envSchema>;

let cached: HermesConfig | null = null;

export function loadConfig(): HermesConfig {
  if (cached) return cached;
  // Render injecteert de te gebruiken poort via PORT en health-checkt DAAROP.
  // PORT wint dus ALTIJD als die gezet is — ook boven een (stale) HERMES_PORT —
  // anders bindt Hermes op een andere poort en faalt de deploy ("No open ports"
  // → update_failed). Lokaal (geen PORT) blijft HERMES_PORT (default 8787).
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (env.PORT) env.HERMES_PORT = env.PORT;
  const parsed = envSchema.safeParse(env);
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

export function telegramEnabled(cfg: HermesConfig): boolean {
  return Boolean(cfg.TELEGRAM_BOT_TOKEN && cfg.TELEGRAM_WEBHOOK_SECRET);
}

/**
 * Bepaalt welke escalatiekanalen actief zijn.
 * - expliciet via HERMES_ESCALATION_CHANNEL ('whatsapp' | 'telegram' | 'both')
 * - anders auto: telegram als geconfigureerd, anders whatsapp (backwards-compat).
 */
export function activeEscalationChannels(
  cfg: HermesConfig,
): Set<'whatsapp' | 'telegram'> {
  const out = new Set<'whatsapp' | 'telegram'>();
  const choice = cfg.HERMES_ESCALATION_CHANNEL;
  if (choice === 'whatsapp' || choice === 'both') out.add('whatsapp');
  if (choice === 'telegram' || choice === 'both') out.add('telegram');
  if (out.size === 0) {
    // auto-detect
    if (telegramEnabled(cfg)) out.add('telegram');
    else out.add('whatsapp');
  }
  return out;
}
