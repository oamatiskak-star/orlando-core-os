import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from './secrets'

export const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  },
)

/**
 * Separate client bound to the `vastgoed_core` schema where Aquier production
 * tables (membership_tiers, user_memberships, checkout_events) live.
 */
export const supabaseVastgoedCore = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'vastgoed_core' as never },
  },
) as unknown as SupabaseClient
