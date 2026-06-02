#!/usr/bin/env bash
# ============================================================================
# hermes-hook.sh — Hermes Claude Code Autopilot F0 (telemetrie)
# ----------------------------------------------------------------------------
# Claude Code roept dit aan op hook-events (Notification/Stop/PreToolUse/...).
# Het stuurt het event naar hermes.record_claude_event zodat Hermes ziet wat
# Claude Code doet. NON-BLOCKING: faalt altijd stil, exit 0, voert NOOIT een
# actie uit en blokkeert nooit een tool (hard default-deny).
#
# Aanroep:  hermes-hook.sh <EventName>      (event-JSON komt op stdin)
# Env:      SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
#           (uit shell, of ~/OSM_STATE/hermes-hook.env / ~/.orlando/hermes-hook.env)
#           optioneel OSM_HOST (anders hostname)
# ============================================================================
set +e

EVENT="${1:-unknown}"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  for f in "$HOME/OSM_STATE/hermes-hook.env" "$HOME/.orlando/hermes-hook.env"; do
    [[ -f "$f" ]] && source "$f"
  done
fi
[[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]] && exit 0

INPUT="$(cat 2>/dev/null)"
HOST="${OSM_HOST:-$(hostname -s 2>/dev/null || echo unknown)}"

getf() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r ".$1 // empty" 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -c "import sys,json
try:
    d=json.load(sys.stdin); v=d.get('$1','')
    print(v if isinstance(v,str) else '')
except Exception:
    pass" 2>/dev/null
  fi
}

SESSION="$(getf session_id)"
CWD="$(getf cwd)"
TOOL="$(getf tool_name)"
MSG="$(getf message)"; [[ -z "$MSG" ]] && MSG="$(getf prompt)"
PROJECT="$(basename "${CWD:-$PWD}" 2>/dev/null)"

case "$EVENT" in
  Notification|notification)      ET=notification ;;
  Stop|stop|SubagentStop)         ET=stop ;;
  PreToolUse|pre_tool_use)        ET=pre_tool_use ;;
  UserPromptSubmit|user_prompt)   ET=user_prompt ;;
  SessionStart|session_start)     ET=session_start ;;
  *)                              ET="$EVENT" ;;
esac

# Body bouwen met veilige JSON-escaping
if command -v python3 >/dev/null 2>&1; then
  BODY="$(python3 - "$HOST" "$SESSION" "$ET" "$CWD" "$PROJECT" "$TOOL" "$MSG" <<'PY' 2>/dev/null
import json, sys
h, s, e, c, p, t, m = (sys.argv[1:8] + [""] * 7)[:7]
print(json.dumps({
    "p_host": h or "unknown",
    "p_session_id": s or None,
    "p_event_type": e,
    "p_cwd": c or None,
    "p_project": p or None,
    "p_tool_name": t or None,
    "p_prompt_text": m or None,
    "p_raw": {},
}))
PY
)"
fi
[[ -z "$BODY" ]] && exit 0

curl -s -m 5 -X POST "$SUPABASE_URL/rest/v1/rpc/record_claude_event" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY" >/dev/null 2>&1

exit 0
