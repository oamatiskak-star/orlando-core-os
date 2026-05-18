#!/usr/bin/env bash
# Voegt MONEYBIRD_API_TOKEN en MONEYBIRD_ADMINISTRATION_ID toe aan orlando-mail-engine
set -euo pipefail

KEY="${RENDER_API_KEY:?Voer RENDER_API_KEY in}"
MBTOKEN="${MBTOKEN:?Voer MBTOKEN in}"
MBADMIN="${MBADMIN:?Voer MBADMIN in}"
MAIL_SVC="srv-d83of0rtqb8s73eka16g"

echo "📋  Huidige env vars ophalen..."
curl -s -H "Authorization: Bearer $KEY" \
  "https://api.render.com/v1/services/$MAIL_SVC/env-vars?limit=50" \
  -o /tmp/current_envs.json

python3 - <<PYEOF
import json

with open("/tmp/current_envs.json") as f:
    data = json.load(f)

payload = [
    {"key": v["envVar"]["key"], "value": v["envVar"]["value"]}
    for v in data if "envVar" in v
]

# Vervang of voeg toe
payload = [p for p in payload if p["key"] not in ("MONEYBIRD_API_TOKEN","MONEYBIRD_ADMINISTRATION_ID")]
payload.append({"key": "MONEYBIRD_API_TOKEN",        "value": "$MBTOKEN"})
payload.append({"key": "MONEYBIRD_ADMINISTRATION_ID","value": "$MBADMIN"})

with open("/tmp/mb_payload.json","w") as f:
    json.dump(payload, f)

print(f"Payload klaar: {len(payload)} vars")
PYEOF

echo "🚀  Vars instellen op orlando-mail-engine..."
curl -s -X PUT \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/mb_payload.json \
  "https://api.render.com/v1/services/$MAIL_SVC/env-vars" | python3 -c "
import json,sys
d=json.load(sys.stdin)
mb=[v for v in d if 'MONEYBIRD' in v.get('envVar',{}).get('key','')]
for v in mb:
  k=v['envVar']['key']
  val=v['envVar']['value']
  print(f'  ✅  {k} = {val[:20]}...')
print(f'Totaal: {len(d)} vars ingesteld')
"

echo ""
echo "🔄  Deploy triggeren..."
curl -s -X POST \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}' \
  "https://api.render.com/v1/services/$MAIL_SVC/deploys" | python3 -c "
import json,sys; d=json.load(sys.stdin); deploy=d.get('deploy',d)
print(f\"✅  Deploy: {deploy.get('id')} — {deploy.get('status')}\")
"
