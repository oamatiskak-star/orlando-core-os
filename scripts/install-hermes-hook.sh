#!/usr/bin/env bash
# ============================================================================
# install-hermes-hook.sh — bedraadt de Hermes F0-telemetrie-hook (idempotent)
# ----------------------------------------------------------------------------
# 1. Maakt ~/OSM_STATE/hermes-hook.env (SUPABASE_URL + SERVICE_ROLE_KEY) op
#    basis van repo .env.prod als die bestaat en de env nog niet bestaat.
# 2. Voegt hermes-hook.sh additief toe aan ~/.claude/settings.json voor de
#    events Notification, Stop, PreToolUse, UserPromptSubmit, SessionStart.
#    Bestaande hooks (bv. Telegram) blijven ongemoeid. Veilig her-uitvoerbaar.
#
# Draai:  bash scripts/install-hermes-hook.sh
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$REPO_ROOT/scripts/hermes-hook.sh"
SETTINGS="$HOME/.claude/settings.json"
ENV_FILE="$HOME/OSM_STATE/hermes-hook.env"

chmod +x "$HOOK" 2>/dev/null || true

# 1) env-bestand
if [[ ! -f "$ENV_FILE" ]]; then
  mkdir -p "$(dirname "$ENV_FILE")"
  URL="$(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL)=' "$REPO_ROOT/.env.prod" 2>/dev/null | head -1 | cut -d= -f2-)"
  KEY="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$REPO_ROOT/.env.prod" 2>/dev/null | head -1 | cut -d= -f2-)"
  if [[ -n "$URL" && -n "$KEY" ]]; then
    printf 'export SUPABASE_URL=%s\nexport SUPABASE_SERVICE_ROLE_KEY=%s\nexport OSM_HOST=%s\n' \
      "$URL" "$KEY" "$(hostname -s)" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "✓ env geschreven: $ENV_FILE"
  else
    echo "⚠ kon SUPABASE_URL/SERVICE_ROLE_KEY niet uit .env.prod halen — vul $ENV_FILE handmatig:"
    echo "   export SUPABASE_URL=https://<ref>.supabase.co"
    echo "   export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>"
  fi
else
  echo "✓ env bestaat al: $ENV_FILE (ongemoeid)"
fi

# 2) settings.json bedraden (idempotent via node)
mkdir -p "$(dirname "$SETTINGS")"
[[ -f "$SETTINGS" ]] || echo '{}' > "$SETTINGS"

HOOK="$HOOK" SETTINGS="$SETTINGS" node <<'NODE'
const fs = require('fs')
const path = process.env.SETTINGS
const hook = process.env.HOOK
const s = JSON.parse(fs.readFileSync(path, 'utf8') || '{}')
s.hooks = s.hooks || {}

// per event: command dat hermes-hook.sh aanroept met de eventnaam
const events = ['Notification', 'Stop', 'PreToolUse', 'UserPromptSubmit', 'SessionStart']
const marker = 'hermes-hook.sh'
let added = 0

for (const ev of events) {
  s.hooks[ev] = s.hooks[ev] || []
  const already = JSON.stringify(s.hooks[ev]).includes(marker)
  if (already) continue
  s.hooks[ev].push({
    hooks: [
      {
        type: 'command',
        command: `bash "${hook}" ${ev} 2>/dev/null || true`,
      },
    ],
  })
  added++
}

fs.writeFileSync(path, JSON.stringify(s, null, 2))
console.log(`✓ settings.json bedraad — ${added} nieuwe hook-entries (bestaande ongemoeid)`)
NODE

echo ""
echo "Klaar. Test: start een Claude Code sessie en check in de DB:"
echo "  select host, session_id, phase, last_event, last_event_at"
echo "  from hermes.claude_session_state order by updated_at desc limit 5;"
