import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Canonical pattern reused from services/hermes + checkout-auditor.
// READ-ONLY usage in this package: we only ever .select(). No writes.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(): { url: string; key: string } {
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill them in.",
    );
  }
  return { url, key: serviceKey };
}

let _public: SupabaseClient | null = null;
let _vastgoed: SupabaseClient | null = null;

/** public schema (affiliate_*, leads, monetization_streams, ...) */
export function supabasePublic(): SupabaseClient {
  if (_public) return _public;
  const { url, key } = requireEnv();
  _public = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });
  return _public;
}

/** vastgoed_core schema (user_memberships, user_report_purchases, checkout_events, ...) */
export function supabaseVastgoedCore(): SupabaseClient {
  if (_vastgoed) return _vastgoed;
  const { url, key } = requireEnv();
  _vastgoed = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "vastgoed_core" as never },
  }) as unknown as SupabaseClient;
  return _vastgoed;
}
