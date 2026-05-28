import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '../core/config.js';

let client: SupabaseClient<any, 'hermes'> | null = null;

export function supabase(): SupabaseClient<any, 'hermes'> {
  if (client) return client;
  const cfg = loadConfig();
  const c = createClient<any, 'hermes'>(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'hermes' },
    global: { headers: { 'x-hermes-service': '1' } },
  });
  client = c;
  return c;
}

export function supabasePublic(): SupabaseClient {
  const cfg = loadConfig();
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
}
