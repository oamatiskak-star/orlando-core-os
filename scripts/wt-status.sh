#!/usr/bin/env bash
# wt-status.sh — Overzicht van alle worktrees, branches en sessies
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREES_BASE="${HOME}/Worktrees"
SESSION_FILE="${HOME}/.orlando-wt-sessions.json"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; BOLD='\033[1m'
DIM='\033[2m'; NC='\033[0m'

[ -f "$SESSION_FILE" ] || echo '{"sessions":{}}' > "$SESSION_FILE"

cd "$REPO_ROOT"

echo -e "\n${BOLD}${CYAN}Orlando Core OS — Git Worktree Status${NC}"
echo -e "${DIM}$(date '+%Y-%m-%d %H:%M:%S') | Repo: $REPO_ROOT${NC}\n"

printf "%-24s %-30s %-10s %-9s %-8s %s\n" "WORKTREE" "BRANCH" "HEAD" "SESSIE" "MACHINE" "LAST COMMIT"
echo "──────────────────────────────────────────────────────────────────────────────────────────────────"

# ── Hoofd worktree ────────────────────────────────────────────────────────────
MAIN_BRANCH=$(git -C "$REPO_ROOT" branch --show-current)
MAIN_HEAD=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "?")
MAIN_MSG=$(git -C "$REPO_ROOT" log -1 --pretty=format:"%s" 2>/dev/null | cut -c1-40 || echo "?")
printf "${GREEN}%-24s${NC} %-30s ${DIM}%-10s${NC} %-9s %-8s ${DIM}%s${NC}\n" \
  "main (hoofd)" "$MAIN_BRANCH" "$MAIN_HEAD" "-" "CLI-L" "$MAIN_MSG"

# ── Alle worktrees ────────────────────────────────────────────────────────────
while IFS= read -r wt_path; do
  [ "$wt_path" = "$REPO_ROOT" ] && continue
  [ -d "$wt_path" ] || continue

  name=$(basename "$wt_path")
  branch=$(git -C "$wt_path" branch --show-current 2>/dev/null || echo "detached")
  head=$(git -C "$wt_path" rev-parse --short HEAD 2>/dev/null || echo "?")
  msg=$(git -C "$wt_path" log -1 --pretty=format:"%s" 2>/dev/null | cut -c1-40 || echo "?")

  # Lees sessie info
  session_info=$(python3 -c "
import json,sys
try:
    d=json.load(open('$SESSION_FILE'))
    s=d.get('sessions',{}).get('$name',{})
    if s:
        print(s.get('machine','?') + '|' + 'claude')
    else:
        print('|')
except:
    print('|')
" 2>/dev/null || echo "|")

  machine="${session_info%%|*}"
  sess_status="${session_info##*|}"

  if [ -n "$sess_status" ]; then
    sess_label="${GREEN}ACTIEF${NC}"
  else
    sess_label="${DIM}vrij${NC}"
    machine="-"
  fi

  # Dirty check
  dirty=$(git -C "$wt_path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  dirty_mark=""
  [ "$dirty" -gt 0 ] && dirty_mark="${YELLOW}*${NC}"

  printf "%-24s %-30s ${DIM}%-10s${NC} %-18b %-8s ${DIM}%s${NC} %b\n" \
    "$name" "$branch" "$head" "$sess_label" "$machine" "$msg" "$dirty_mark"

done < <(git worktree list --porcelain | grep "^worktree " | awk '{print $2}')

echo
# ── Sessie samenvatting ───────────────────────────────────────────────────────
ACTIVE_COUNT=$(python3 -c "
import json
try:
    d=json.load(open('$SESSION_FILE'))
    print(len(d.get('sessions',{})))
except:
    print(0)
" 2>/dev/null || echo 0)

echo -e "Actieve Claude sessies: ${BOLD}$ACTIVE_COUNT${NC}"

# ── Orphaned worktrees detecteren ─────────────────────────────────────────────
PRUNE_OUTPUT=$(git worktree prune --dry-run 2>&1 || true)
if [ -n "$PRUNE_OUTPUT" ]; then
  echo -e "\n${YELLOW}[WARN] Orphaned worktrees gevonden:${NC}"
  echo "$PRUNE_OUTPUT"
  echo -e "${DIM}Voer 'scripts/wt.sh clean' uit om op te ruimen.${NC}"
fi

# ── Lopende git.lock bestanden ────────────────────────────────────────────────
LOCKS=$(find "$REPO_ROOT/.git" -name "*.lock" 2>/dev/null | head -5)
if [ -n "$LOCKS" ]; then
  echo -e "\n${RED}[WARN] Git lock bestanden gevonden:${NC}"
  echo "$LOCKS"
fi

echo
