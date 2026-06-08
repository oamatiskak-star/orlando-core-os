require("dotenv/config");
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const { data: chans, error } = await db.from("youtube_channels")
    .select("id, name, naam, refresh_token, token_expires, oauth_client_id, oauth_client_secret")
    .in("oauth_status", ["connected","expired","reconnect_required","refresh_error"])
    .not("refresh_token","is",null);
  if (error) { console.error("query fout:", error.message); process.exit(1); }
  const res = [];
  for (const c of chans) {
    const nm = c.naam || c.name;
    if (!c.oauth_client_id || !c.oauth_client_secret) { res.push([nm,"RE-CONSENT NODIG (geen eigen client)"]); continue; }
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({client_id:c.oauth_client_id, client_secret:c.oauth_client_secret, refresh_token:c.refresh_token, grant_type:"refresh_token"})
      });
      const j = await r.json();
      if (!r.ok) {
        const reconnect = ["invalid_grant","unauthorized_client","invalid_client"].includes(j.error);
        await db.from("youtube_channels").update({ oauth_status: reconnect?"reconnect_required":"refresh_error", oauth_connected:false }).eq("id",c.id);
        res.push([nm, (reconnect?"RE-CONSENT: ":"FOUT: ")+(j.error||r.status)]); continue;
      }
      const exp = new Date(Date.now()+(j.expires_in||3600)*1000).toISOString();
      await db.from("youtube_channels").update({ access_token:j.access_token, token_expires:exp, oauth_status:"connected", oauth_connected:true, status:"active" }).eq("id",c.id);
      res.push([nm,"VERFRIST ✓"]);
    } catch(e){ res.push([nm,"EXCEPTIE: "+e.message]); }
  }
  console.log("\n=== RESULTAAT ===");
  res.forEach(([n,s])=>console.log(" "+n.padEnd(22)+" "+s));
  console.log("verfrist: "+res.filter(r=>r[1].includes("VERFRIST")).length+" / re-consent: "+res.filter(r=>r[1].includes("RE-CONSENT")).length);
})();
