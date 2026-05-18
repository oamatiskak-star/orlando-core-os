import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config.js'

let _client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (_client) return _client
  _client = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  })
  return _client
}

export async function logRouter(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db().from('ai_router_logs').insert({
      level,
      scope: 'router',
      message,
      context,
    })
  } catch {
    // swallow; never let logging break a request path
  }
}
