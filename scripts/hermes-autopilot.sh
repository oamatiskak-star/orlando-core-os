#!/usr/bin/env bash
# ============================================================================
# hermes-autopilot.sh — Hermes neemt Claude Code's 1/2/3 permissie-prompts over
# ----------------------------------------------------------------------------
# PreToolUse-hook. Beslist of een tool-aanroep automatisch wordt goedgekeurd.
# HARDE DEFAULT-DENY: alleen aantoonbaar veilige, read-only tools → 'allow'.
# Al het andere → 'ask' (jouw normale prompt; jij beslist). Auto-DENY doen we
# niet (zou legitiem werk blokkeren) — niet-veilig = jij beslist.
#
# Modus:
#   dry-run (default)          : logt wat het ZOU doen, geeft altijd 'ask'.
#   HERMES_AUTOPILOT_LIVE=1     : keurt veilige tools echt goed ('allow').
#
# Output (stdout, exit 0):
#   {"hookSpecificOutput":{"hookEventName":"PreToolUse",
#     "permissionDecision":"allow|ask","permissionDecisionReason":"..."}}
#
# Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (telemetrie, best-effort),
#      HERMES_AUTOPILOT_LIVE, OSM_HOST.
# ============================================================================
set +e

INPUT="$(cat 2>/dev/null)"

# env laden (zelfde bron als hermes-hook.sh)
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  for f in "$HOME/OSM_STATE/hermes-hook.env" "$HOME/.orlando/hermes-hook.env"; do
    [[ -f "$f" ]] && source "$f"
  done
fi

getf() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r "$1 // empty" 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -c "import sys,json
try:
    d=json.load(sys.stdin)
    print(eval('d$2', {}, {'d': d}) or '')
except Exception:
    pass" 2>/dev/null
  fi
}

TOOL="$(getf '.tool_name' \"['tool_name']\")"
CMD="$(getf '.tool_input.command' \"['tool_input']['command']\")"
SESSION="$(getf '.session_id' \"['session_id']\")"
CWD="$(getf '.cwd' \"['cwd']\")"
HOST="${OSM_HOST:-$(hostname -s 2>/dev/null || echo unknown)}"
PROJECT="$(basename "${CWD:-$PWD}" 2>/dev/null)"

emit() {  # $1=decision  $2=reason
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":"%s"}}\n' "$1" "$2"
}

# ── DENY-LIST model: standaard TOESTAAN; alleen écht risicovol → jij beslist ──
# (masterplan: default-deny enkel op deploy/merge/migratie/Stripe/prijzen/data-
#  verwijdering). Normaal werk — Edit/Write/lezen/veilige bash — gaat automatisch.
SAFE=1
REASON="toegestaan (geen risicopatroon)"

case "$TOOL" in
  # Risicovolle MCP-acties (mutaties/deploys/DB/Stripe) → jij beslist
  *apply_migration*|*execute_sql*|*deploy_edge_function*|*deploy_to_vercel*|*create_project*|*pause_project*|*restore*|*merge_branch*|*reset_branch*|*delete_branch*|*delete_*|*cancel_subscription*|*update_subscription*|*create_refund*|*create_payment*|*create_price*|*create_product*|*update_product*|*archive_product*|*set_branding*|*create_coupon*|*update_dispute*)
    SAFE=0; REASON="risicovolle MCP-actie ($TOOL) → jij beslist"
    ;;
  Bash)
    # Gevaarlijke shell-patronen → jij beslist; al het andere mag.
    if printf '%s' "$CMD" | grep -qiE '(\brm\b\s+-?[a-z]*[rf]|\brm\b\s+-|\b(sudo|dd|mkfs|shutdown|reboot|halt|kill|killall|pkill|chown)\b|chmod\s+(-R\s+)?[0-7]*7[0-7]*7|git\s+(push|merge|rebase|reset\s+--hard|clean\s+-[a-z]*f|stash\s+drop|branch\s+-D)|gh\s+(pr\s+merge|release)|>\s*\.env|\.env\b.*>|vercel\b|\brender\b|\bdeploy\b|pm2\s+(delete|stop|kill|save)|launchctl|npm\s+publish|(curl|wget)[^|]*\|\s*(ba|z)?sh|drop\s+(table|database|schema)|truncate\b|delete\s+from|supabase\s+db\s+(reset|push)|psql.*-c|:\(\)\s*\{)'; then
      SAFE=0; REASON="risicovol shell-patroon → jij beslist"
    fi
    ;;
  Read|Glob|Grep|LS|NotebookRead|NotebookEdit|TodoWrite|Edit|MultiEdit|Write|Task)
    SAFE=1; REASON="normaal werk-tool ($TOOL)"
    ;;
esac

# LIVE-modus: gescoopte vlag sessie(tab) → host(machine) → globaal, met default
# "aan op vertrouwde hosts" (RPC hermes_autopilot_effective). 30s cache per sessie
# om latency per tool-aanroep te vermijden. Env HERMES_AUTOPILOT_LIVE=1 forceert aan.
LIVE=0
FLAG=0
CACHE="$HOME/OSM_STATE/.autopilot_${SESSION:-default}"
if [[ -f "$CACHE" ]]; then
  CAGE=$(( $(date +%s) - $(stat -f %m "$CACHE" 2>/dev/null || stat -c %Y "$CACHE" 2>/dev/null || echo 0) ))
else
  CAGE=99999
fi
if [[ $CAGE -lt 30 ]]; then
  FLAG="$(cat "$CACHE" 2>/dev/null)"
elif [[ -n "$SUPABASE_URL" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
  EFF="$(curl -s -m 2 -X POST "$SUPABASE_URL/rest/v1/rpc/hermes_autopilot_effective" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"p_host\":\"$HOST\",\"p_session\":\"$SESSION\"}" 2>/dev/null)"
  [[ "$EFF" == "true" ]] && FLAG=1 || FLAG=0
  mkdir -p "$(dirname "$CACHE")"; printf '%s' "$FLAG" > "$CACHE"
fi
[[ "$FLAG" == "1" ]] && LIVE=1
[[ "${HERMES_AUTOPILOT_LIVE:-}" == "1" ]] && LIVE=1

# ── Beslissing ──────────────────────────────────────────────────────────────
if [[ $SAFE -eq 1 && $LIVE -eq 1 ]]; then
  DECISION="allow"
elif [[ $SAFE -eq 1 ]]; then
  DECISION="ask"; REASON="DRY-RUN: zou auto-goedkeuren ($REASON)"
else
  DECISION="ask"
fi

# prompt-soort classificeren (F3)
case "$TOOL" in
  Bash) KIND=bash ;;
  *)    KIND=tool_permission ;;
esac
WOULD_ALLOW=false; [[ $SAFE -eq 1 ]] && WOULD_ALLOW=true
LIVE_B=false;     [[ $LIVE -eq 1 ]] && LIVE_B=true

# ── Beslissings-audit (F3, gedetacheerd) ────────────────────────────────────
if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]] && command -v python3 >/dev/null 2>&1; then
  DBODY="$(python3 - "$HOST" "$SESSION" "$CWD" "$PROJECT" "$TOOL" "$KIND" "$CMD" "$DECISION" "$WOULD_ALLOW" "$LIVE_B" "$REASON" <<'PY' 2>/dev/null
import json, sys
h, s, c, p, t, k, cmd, dec, wa, live, reason = (sys.argv[1:12] + [""] * 11)[:11]
print(json.dumps({
    "p_host": h or "unknown", "p_session_id": s or None, "p_cwd": c or None, "p_project": p or None,
    "p_tool_name": t or None, "p_kind": k or None, "p_prompt_text": (cmd or t or "")[:500],
    "p_decision": dec, "p_would_allow": wa == "true", "p_live": live == "true", "p_reason": reason or None,
}))
PY
)"
  if [[ -n "$DBODY" ]]; then
    ( curl -s -m 3 -X POST "$SUPABASE_URL/rest/v1/rpc/log_autopilot_decision" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" -d "$DBODY" >/dev/null 2>&1 & )
  fi
fi

# ── Telemetrie (gedetacheerd, blokkeert de beslissing nooit) ────────────────
if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]] && command -v python3 >/dev/null 2>&1; then
  BODY="$(python3 - "$HOST" "$SESSION" "$CWD" "$PROJECT" "$TOOL" "$CMD" "$DECISION" "$REASON" "$SAFE" "$LIVE" <<'PY' 2>/dev/null
import json, sys
h, s, c, p, t, cmd, dec, reason, safe, live = (sys.argv[1:11] + [""] * 10)[:10]
print(json.dumps({
    "p_host": h or "unknown", "p_session_id": s or None, "p_event_type": "pre_tool_use",
    "p_cwd": c or None, "p_project": p or None, "p_tool_name": t or None,
    "p_prompt_text": (cmd or t or "")[:500],
    "p_raw": {"decision": dec, "reason": reason, "safe": safe == "1", "live": live == "1", "autopilot": True},
}))
PY
)"
  if [[ -n "$BODY" ]]; then
    ( curl -s -m 3 -X POST "$SUPABASE_URL/rest/v1/rpc/record_claude_event" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" -d "$BODY" >/dev/null 2>&1 & )
  fi
fi

emit "$DECISION" "$REASON"
exit 0
