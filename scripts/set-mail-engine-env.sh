#!/usr/bin/env bash
# set-mail-engine-env.sh
# Gebruik: RENDER_API_KEY=rnd_xxx bash scripts/set-mail-engine-env.sh
# Optioneel extra vars meegeven:
#   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=xxx bash scripts/set-mail-engine-env.sh

set -euo pipefail

API="https://api.render.com/v1"
KEY="${RENDER_API_KEY:?Voer RENDER_API_KEY=rnd_xxx in}"

echo "🔍  Services ophalen..."
SERVICES=$(curl -sf -H "Authorization: Bearer $KEY" "$API/services?limit=100")

get_service_id() {
  echo "$SERVICES" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for item in data:
  s=item.get('service',item)
  if s.get('name')=='$1':
    print(s['id']); break
"
}

MAIL_ID=$(get_service_id "orlando-mail-engine")
YT_ID=$(get_service_id "orlando-youtube-engine")

if [[ -z "$MAIL_ID" ]]; then
  echo "❌  orlando-mail-engine niet gevonden. Is de deploy al gestart?"
  exit 1
fi
echo "✅  orlando-mail-engine: $MAIL_ID"

# ── Haal env vars op van youtube-engine (Supabase + Anthropic zitten daar al in) ──
echo "📋  Env vars ophalen van orlando-youtube-engine..."
YT_ENVS=""
if [[ -n "$YT_ID" ]]; then
  YT_ENVS=$(curl -sf -H "Authorization: Bearer $KEY" "$API/services/$YT_ID/env-vars" 2>/dev/null || echo "[]")
fi

get_yt_var() {
  echo "$YT_ENVS" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for v in data:
  if v.get('envVar',{}).get('key')=='$1':
    print(v.get('envVar',{}).get('value','')); break
" 2>/dev/null || true
}

SUPABASE_URL=$(get_yt_var "SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY=$(get_yt_var "SUPABASE_SERVICE_ROLE_KEY")
ANTHROPIC_API_KEY_VAL=$(get_yt_var "ANTHROPIC_API_KEY")
TELEGRAM_BOT_TOKEN=$(get_yt_var "TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID=$(get_yt_var "TELEGRAM_CHAT_ID")

# ── Gmail: gebruik GMAIL_CLIENT_ID env var of val uit youtube-engine ──
GMAIL_CLIENT_ID="${GMAIL_CLIENT_ID:-$(get_yt_var "YOUTUBE_OAUTH_CLIENT_ID")}"
GMAIL_CLIENT_SECRET="${GMAIL_CLIENT_SECRET:-$(get_yt_var "YOUTUBE_OAUTH_CLIENT_SECRET")}"

# ── Moneybird: uit env of leeg (stel later in via dashboard) ──
MONEYBIRD_API_TOKEN="${MONEYBIRD_API_TOKEN:-}"
MONEYBIRD_ADMINISTRATION_ID="${MONEYBIRD_ADMINISTRATION_ID:-}"

# ── Overzicht tonen ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Env vars voor orlando-mail-engine"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUPABASE_URL              = ${SUPABASE_URL:0:40}..."
echo "  SUPABASE_SERVICE_ROLE_KEY = ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo "  ANTHROPIC_API_KEY         = ${ANTHROPIC_API_KEY_VAL:0:20}..."
echo "  GMAIL_CLIENT_ID           = ${GMAIL_CLIENT_ID:0:30}..."
echo "  GMAIL_CLIENT_SECRET       = ${GMAIL_CLIENT_SECRET:0:10}..."
echo "  MONEYBIRD_API_TOKEN       = ${MONEYBIRD_API_TOKEN:-'(leeg — later instellen)'}"
echo "  MONEYBIRD_ADMINISTRATION_ID = ${MONEYBIRD_ADMINISTRATION_ID:-'(leeg — later instellen)'}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Bouw env var payload ──
build_var() { printf '{"key":"%s","value":"%s"}' "$1" "$2"; }

VARS="["
VARS+=$(build_var "NODE_ENV" "production"); VARS+=","
VARS+=$(build_var "PORT" "3003"); VARS+=","
VARS+=$(build_var "LOG_LEVEL" "info"); VARS+=","
[[ -n "$SUPABASE_URL" ]]              && VARS+=$(build_var "SUPABASE_URL" "$SUPABASE_URL")","
[[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]] && VARS+=$(build_var "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY")","
[[ -n "$ANTHROPIC_API_KEY_VAL" ]]     && VARS+=$(build_var "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY_VAL")","
[[ -n "$GMAIL_CLIENT_ID" ]]           && VARS+=$(build_var "GMAIL_CLIENT_ID" "$GMAIL_CLIENT_ID")","
[[ -n "$GMAIL_CLIENT_SECRET" ]]       && VARS+=$(build_var "GMAIL_CLIENT_SECRET" "$GMAIL_CLIENT_SECRET")","
[[ -n "$TELEGRAM_BOT_TOKEN" ]]        && VARS+=$(build_var "TELEGRAM_BOT_TOKEN" "$TELEGRAM_BOT_TOKEN")","
[[ -n "$TELEGRAM_CHAT_ID" ]]          && VARS+=$(build_var "TELEGRAM_CHAT_ID" "$TELEGRAM_CHAT_ID")","
[[ -n "$MONEYBIRD_API_TOKEN" ]]       && VARS+=$(build_var "MONEYBIRD_API_TOKEN" "$MONEYBIRD_API_TOKEN")","
[[ -n "$MONEYBIRD_ADMINISTRATION_ID" ]] && VARS+=$(build_var "MONEYBIRD_ADMINISTRATION_ID" "$MONEYBIRD_ADMINISTRATION_ID")","

# Verwijder trailing comma en sluit array
VARS="${VARS%,}]"

echo "🚀  Env vars instellen op orlando-mail-engine..."
RESULT=$(curl -sf -X PUT \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"envVars\": $VARS}" \
  "$API/services/$MAIL_ID/env-vars")

COUNT=$(echo "$RESULT" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
echo "✅  $COUNT env vars ingesteld."
echo ""
echo "🔄  Deploy triggeren..."
curl -sf -X POST \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}' \
  "$API/services/$MAIL_ID/deploys" > /dev/null

echo "✅  Deploy gestart. Volg op: https://dashboard.render.com/web/$MAIL_ID"
echo ""
if [[ -z "$MONEYBIRD_API_TOKEN" ]]; then
  echo "⚠️  MONEYBIRD_API_TOKEN is leeg — stel later in via Render dashboard."
fi
