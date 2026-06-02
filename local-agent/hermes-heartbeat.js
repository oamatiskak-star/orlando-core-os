// Hermes host-heartbeat — laat Hermes zien dat cli-l leeft.
// Update hermes.hosts.last_seen_at elke 30s. Productie, geen mock.
require("dotenv/config");
const { createClient } = require("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HOST = process.env.WATCHDOG_HOST_ID || "cli-l";
const EVERY = parseInt(process.env.HERMES_HEARTBEAT_MS || "30000", 10);
if (!URL || !KEY) { console.error("[hermes-heartbeat] SUPABASE creds ontbreken"); process.exit(1); }
const db = createClient(URL, KEY, { auth: { persistSession: false } });
async function beat() {
  const now = new Date().toISOString();
  const { error } = await db.schema("hermes").from("hosts")
    .update({ last_seen_at: now, updated_at: now, active: true }).eq("host_id", HOST);
  if (error) console.error(`[${now}] [hermes-heartbeat] fout:`, error.message);
  else console.log(`[${now}] [hermes-heartbeat] ${HOST} alive`);
}
beat();
setInterval(beat, EVERY);
