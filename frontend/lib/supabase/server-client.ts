import { createClient as createServerClient } from '@supabase/supabase-js'

let instance: ReturnType<typeof createServerClient> | null = null

export function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase credentials: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
  }

  if (!instance) {
    instance = createServerClient(url, key)
  }

  return instance
}
