import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '../core/config.js';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const cfg = loadConfig();
  client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'hermes' },
    global: { headers: { 'x-hermes-service': '1' } },
  });
  return client;
}

export function supabasePublic(): SupabaseClient {
  const cfg = loadConfig();
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
}
