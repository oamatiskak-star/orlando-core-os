#!/usr/bin/env bash
# wt-clean.sh — Verwijder orphaned worktrees en oude sessies
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_FILE="${HOME}/.orlando-wt-sessions.json"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

cd "$REPO_ROOT"

echo -e "\n${BOLD}Worktree Cleanup${NC}\n"

# ── 1. Git lock bestanden verwijderen (ouder dan 10 min) ──────────────────────
echo -e "${YELLOW}[1/3]${NC} Checking git lock bestanden..."
OLD_LOCKS=$(find "$REPO_ROOT/.git" -name "*.lock" -mmin +10 2>/dev/null || true)
if [ -n "$OLD_LOCKS" ]; then
  echo "$OLD_LOCKS"
  read -r -p "Verwijder bovenstaande lock bestanden? [y/N] " CONFIRM
  if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
    echo "$OLD_LOCKS" | xargs rm -f
    echo -e "${GREEN}Lock bestanden verwijderd.${NC}"
  fi
else
  echo -e "${DIM}Geen lock bestanden gevonden.${NC}"
fi

# ── 2. Orphaned worktrees prunen ──────────────────────────────────────────────
echo -e "\n${YELLOW}[2/3]${NC} Checking orphaned worktrees..."
PRUNE_DRY=$(git worktree prune --dry-run 2>&1 || true)
if [ -n "$PRUNE_DRY" ]; then
  echo -e "${YELLOW}Te verwijderen:${NC}\n$PRUNE_DRY"
  read -r -p "Prunen? [y/N] " CONFIRM
  if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
    git worktree prune
    echo -e "${GREEN}Orphaned worktrees verwijderd.${NC}"
  fi
else
  echo -e "${DIM}Geen orphaned worktrees.${NC}"
fi

# ── 3. Sessies opruimen voor niet-bestaande worktrees ────────────────────────
echo -e "\n${YELLOW}[3/3]${NC} Checking stale sessies..."
if [ -f "$SESSION_FILE" ]; then
  STALE=$(python3 -c "
import json, os
d = json.load(open('$SESSION_FILE'))
sessions = d.get('sessions', {})
stale = []
for name in list(sessions.keys()):
    path = os.path.expanduser(f'~/Worktrees/{name}')
    if not os.path.isdir(path):
        stale.append(name)
print('\n'.join(stale))
" 2>/dev/null || echo "")

  if [ -n "$STALE" ]; then
    echo -e "${YELLOW}Stale sessies (worktree niet meer aanwezig):${NC}"
    echo "$STALE"
    read -r -p "Verwijder stale sessies? [y/N] " CONFIRM
    if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
      python3 -c "
import json, os
d = json.load(open('$SESSION_FILE'))
sessions = d.get('sessions', {})
removed = 0
for name in list(sessions.keys()):
    path = os.path.expanduser(f'~/Worktrees/{name}')
    if not os.path.isdir(path):
        del sessions[name]
        removed += 1
json.dump(d, open('$SESSION_FILE', 'w'), indent=2)
print(f'{removed} sessie(s) verwijderd.')
"
    fi
  else
    echo -e "${DIM}Geen stale sessies.${NC}"
  fi
fi

echo -e "\n${GREEN}Cleanup klaar.${NC}\n"
