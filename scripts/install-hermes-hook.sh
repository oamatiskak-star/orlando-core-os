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
AUTOPILOT="$REPO_ROOT/scripts/hermes-autopilot.sh"
SETTINGS="$HOME/.claude/settings.json"
ENV_FILE="$HOME/OSM_STATE/hermes-hook.env"

chmod +x "$HOOK" "$AUTOPILOT" 2>/dev/null || true

# 1) env-bestand
if [[ ! -f "$ENV_FILE" ]]; then
  mkdir -p "$(dirname "$ENV_FILE")"
  URL="$(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL)=' "$REPO_ROOT/.env.prod" 2>/dev/null | head -1 | cut -d= -f2-)"
  KEY="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$REPO_ROOT/.env.prod" 2>/dev/null | head -1 | cut -d= -f2-)"
  if [[ -n "$URL" && -n "$KEY" ]]; then
    printf 'export SUPABASE_URL=%s\nexport SUPABASE_SERVICE_ROLE_KEY=%s\nexport OSM_HOST=%s\n# Zet op 1 om de autopilot veilige tools ECHT te laten goedkeuren (anders dry-run):\nexport HERMES_AUTOPILOT_LIVE=0\n' \
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

HOOK="$HOOK" AUTOPILOT="$AUTOPILOT" SETTINGS="$SETTINGS" node <<'NODE'
const fs = require('fs')
const path = process.env.SETTINGS
const hook = process.env.HOOK
const autopilot = process.env.AUTOPILOT
const s = JSON.parse(fs.readFileSync(path, 'utf8') || '{}')
s.hooks = s.hooks || {}
let added = 0

// Telemetrie-hook (read-only logging) op de niet-tool events.
for (const ev of ['Notification', 'Stop', 'UserPromptSubmit', 'SessionStart']) {
  s.hooks[ev] = s.hooks[ev] || []
  if (JSON.stringify(s.hooks[ev]).includes('hermes-hook.sh')) continue
  s.hooks[ev].push({ hooks: [{ type: 'command', command: `bash "${hook}" ${ev} 2>/dev/null || true` }] })
  added++
}

// Autopilot op PreToolUse (matcher * = alle tools). Beslist allow/ask.
s.hooks.PreToolUse = s.hooks.PreToolUse || []
if (!JSON.stringify(s.hooks.PreToolUse).includes('hermes-autopilot.sh')) {
  s.hooks.PreToolUse.push({
    matcher: '*',
    hooks: [{ type: 'command', command: `bash "${autopilot}"`, timeout: 5 }],
  })
  added++
}

fs.writeFileSync(path, JSON.stringify(s, null, 2))
console.log(`✓ settings.json bedraad — ${added} nieuwe hook-entries (bestaande ongemoeid)`)
NODE

echo ""
echo "Klaar. Telemetrie loopt direct (dry-run autopilot)."
echo ""
echo "Autopilot demo (Hermes neemt veilige 1/2/3-prompts over):"
echo "  1. Open ~/OSM_STATE/hermes-hook.env en zet HERMES_AUTOPILOT_LIVE=1"
echo "  2. Start een NIEUWE Claude Code sessie (hooks laden bij start)"
echo "  3. Vraag iets read-only (bv. 'lees package.json' of 'git status')"
echo "     → Claude vraagt GEEN 1/2/3 meer; Hermes keurt veilig automatisch goed."
echo "     Risicovol (rm, deploy, git push, edit) → jij krijgt nog steeds de prompt."
echo ""
echo "Volg live in de DB:"
echo "  select created_at, tool_name, left(prompt_text,50) txt, raw->>'decision' beslissing"
echo "  from hermes.claude_prompts where event_type='pre_tool_use' order by created_at desc limit 10;"
