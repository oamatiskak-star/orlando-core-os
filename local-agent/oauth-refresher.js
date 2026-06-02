require("dotenv/config");
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const EVERY = parseInt(process.env.OAUTH_REFRESH_MS || "1800000", 10); // 30 min
async function run() {
  const ts = new Date().toISOString();
  const { data: chans, error } = await db.from("youtube_channels")
    .select("id, name, naam, refresh_token, token_expires, oauth_client_id, oauth_client_secret")
    .in("oauth_status", ["connected","expired","refresh_error"]).not("refresh_token","is",null);
  if (error) { console.error(`[${ts}] query fout:`, error.message); return; }
  let ok=0, skip=0, need=0;
  for (const c of chans) {
    if (!c.oauth_client_id || !c.oauth_client_secret) { need++; continue; } // re-consent: laat staan
    const exp = c.token_expires ? new Date(c.token_expires) : new Date(0);
    if (exp > new Date(Date.now()+10*60*1000)) { skip++; continue; } // nog ruim geldig
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({client_id:c.oauth_client_id, client_secret:c.oauth_client_secret, refresh_token:c.refresh_token, grant_type:"refresh_token"}) });
      const j = await r.json();
      if (!r.ok) { const rc=["invalid_grant","unauthorized_client","invalid_client"].includes(j.error);
        await db.from("youtube_channels").update({oauth_status:rc?"reconnect_required":"refresh_error",oauth_connected:false}).eq("id",c.id); continue; }
      await db.from("youtube_channels").update({access_token:j.access_token, token_expires:new Date(Date.now()+(j.expires_in||3600)*1000).toISOString(), oauth_status:"connected", oauth_connected:true, status:"active"}).eq("id",c.id);
      ok++;
    } catch(e){ console.error(`[${ts}] ${c.naam||c.name}:`, e.message); }
  }
  console.log(`[${ts}] [oauth-refresher] verfrist=${ok} nog-geldig=${skip} re-consent=${need}`);
}
run(); setInterval(run, EVERY);
