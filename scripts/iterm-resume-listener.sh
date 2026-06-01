#!/usr/bin/env bash
# iTerm2 resume-listener voor de "Ga verder"-knop in het dashboard.
#
# Draai dit op ELKE host (cli-l én cli-r). Het pollt public.osm_terminal_commands
# voor commando's met machine_id = deze host, opent iTerm2 in de juiste worktree,
# typt `claude` + Enter, en plakt daarna de prompt om verder te gaan.
#
# Vereist:  jq, curl, iTerm2, macOS Toegankelijkheid-rechten voor de terminal/script.
# Env:
#   SUPABASE_URL                (bv https://shaunumewswpxhmgbtvv.supabase.co)
#   SUPABASE_SERVICE_ROLE_KEY   (service-role key)
#   MACHINE_ID                  (cli-l of cli-r)  — host-identiteit
#   CLAUDE_BOOT_DELAY           (optioneel, sec wachten tot Claude klaar is; default 5)
#   POLL_INTERVAL               (optioneel, sec; default 4)
#
# Start:  MACHINE_ID=cli-r ./scripts/iterm-resume-listener.sh

set -euo pipefail
: "${SUPABASE_URL:?zet SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?zet SUPABASE_SERVICE_ROLE_KEY}"
: "${MACHINE_ID:?zet MACHINE_ID (cli-l of cli-r)}"
BOOT_DELAY="${CLAUDE_BOOT_DELAY:-5}"
POLL="${POLL_INTERVAL:-4}"
REST="$SUPABASE_URL/rest/v1/osm_terminal_commands"
AUTH=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

heartbeat() {
  curl -s -m 8 -X POST "$SUPABASE_URL/rest/v1/rpc/host_heartbeat" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"p_machine\":\"$MACHINE_ID\",\"p_workers\":[\"resume-listener\"],\"p_note\":\"$MACHINE_ID online\"}" >/dev/null 2>&1 || true
}

echo "[$(date '+%H:%M:%S')] resume-listener actief op $MACHINE_ID — pollt elke ${POLL}s"
heartbeat          # meld direct online bij Hermes
hb_count=0

# Desktop: gewone iTerm2-window. Met prompt = klembord-paste; lege prompt = verse sessie.
launch_desktop() {
  local worktree="$1" prompt="$2"
  worktree="${worktree/#\~/$HOME}"
  if [ -z "$prompt" ]; then
    /usr/bin/osascript <<OSA
tell application "iTerm2"
  activate
  set w to (create window with default profile)
  tell current session of w to write text "cd '$worktree' && claude"
end tell
OSA
    return
  fi
  printf '%s' "$prompt" | pbcopy
  /usr/bin/osascript <<OSA
tell application "iTerm2"
  activate
  set w to (create window with default profile)
  tell current session of w to write text "cd '$worktree' && claude"
end tell
delay $BOOT_DELAY
tell application "System Events"
  keystroke "v" using command down
  delay 0.4
  key code 36
end tell
OSA
}

# Mobiel: draai claude in een NAMED tmux-sessie zodat iTerm2 (host) én Terminus
# (iPhone) exact hetzelfde venster delen. Prompt via tmux-buffer (bracketed paste).
launch_mobile_tmux() {
  local worktree="$1" prompt="$2" session="$3"
  worktree="${worktree/#\~/$HOME}"
  tmux has-session -t "$session" 2>/dev/null || tmux new-session -d -s "$session" -c "$worktree"
  tmux send-keys -t "$session" 'claude' Enter
  if [ -n "$prompt" ]; then
    sleep "$BOOT_DELAY"
    printf '%s' "$prompt" | tmux load-buffer -
    tmux paste-buffer -p -t "$session"        # -p = bracketed paste (Claude leest 't als één invoer)
    tmux send-keys -t "$session" Enter
  fi
  # Open hetzelfde venster lokaal in iTerm2 (tmux-control mode) zodat de host meekijkt.
  /usr/bin/osascript <<OSA
tell application "iTerm2"
  activate
  set w to (create window with default profile)
  tell current session of w to write text "tmux attach -t '$session'"
end tell
OSA
}

while true; do
  row="$(curl -s "${AUTH[@]}" \
    "$REST?machine_id=eq.$MACHINE_ID&status=eq.queued&order=created_at.asc&limit=1")"
  id="$(echo "$row" | jq -r '.[0].id // empty')"
  if [ -n "$id" ]; then
    # claim (alleen als nog queued)
    claimed="$(curl -s "${AUTH[@]}" -X PATCH -H "Content-Type: application/json" -H "Prefer: return=representation" \
      "$REST?id=eq.$id&status=eq.queued" \
      -d "{\"status\":\"claimed\",\"claimed_by\":\"$MACHINE_ID\",\"claimed_at\":\"$(date -u +%FT%TZ)\"}")"
    if [ "$(echo "$claimed" | jq -r 'length')" = "1" ]; then
      worktree="$(echo "$claimed" | jq -r '.[0].worktree_path')"
      prompt="$(echo "$claimed" | jq -r '.[0].prompt')"
      title="$(echo "$claimed" | jq -r '.[0].title // "build"')"
      mobile="$(echo "$claimed" | jq -r '.[0].from_mobile')"
      session="$(echo "$claimed" | jq -r '.[0].tmux_session // empty')"
      if [ "$mobile" = "true" ] && [ -n "$session" ]; then
        echo "[$(date '+%H:%M:%S')] start (mobiel/tmux $session): $title → $worktree"
        if launch_mobile_tmux "$worktree" "$prompt" "$session"; then st=done; else st=failed; fi
      else
        echo "[$(date '+%H:%M:%S')] start: $title → $worktree"
        if launch_desktop "$worktree" "$prompt"; then st=done; else st=failed; fi
      fi
      curl -s "${AUTH[@]}" -X PATCH -H "Content-Type: application/json" \
        "$REST?id=eq.$id" -d "{\"status\":\"$st\",\"result\":{\"machine\":\"$MACHINE_ID\"}}" >/dev/null
    fi
  fi
  hb_count=$((hb_count + 1))
  if [ $((hb_count % 15)) -eq 0 ]; then heartbeat; fi   # ~elke 60s online-melding
  sleep "$POLL"
done
