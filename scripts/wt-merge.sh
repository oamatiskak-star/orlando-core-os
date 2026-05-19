#!/usr/bin/env bash
# wt-merge.sh — Merge een worktree branch naar main
# Gebruik: wt-merge.sh <worktree-naam> [--squash]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREES_BASE="${HOME}/Worktrees"
SESSION_FILE="${HOME}/.orlando-wt-sessions.json"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

NAME="${1:-}"
SQUASH="${2:-}"

if [ -z "$NAME" ]; then
  echo -e "${RED}Gebruik: wt-merge.sh <naam> [--squash]${NC}"; exit 1
fi

WT_PATH="$WORKTREES_BASE/$NAME"

if [ ! -d "$WT_PATH" ]; then
  echo -e "${RED}Worktree '$NAME' niet gevonden op $WT_PATH${NC}"; exit 1
fi

cd "$WT_PATH"
BRANCH=$(git branch --show-current)
HEAD=$(git rev-parse --short HEAD)

echo -e "\n${BOLD}Merge Voorbereiding${NC}"
echo -e "  Worktree : $NAME"
echo -e "  Branch   : $BRANCH"
echo -e "  HEAD     : $HEAD"

# ── Check actieve sessie ──────────────────────────────────────────────────────
if [ -f "$SESSION_FILE" ]; then
  SESS=$(python3 -c "
import json
d=json.load(open('$SESSION_FILE'))
s=d.get('sessions',{}).get('$NAME',{})
print(s.get('machine','') if s else '')
" 2>/dev/null || echo "")
  if [ -n "$SESS" ]; then
    echo -e "\n${YELLOW}[WARN] Worktree '$NAME' heeft een actieve sessie op $SESS${NC}"
    read -r -p "Toch doorgaan? [y/N] " CONFIRM
    [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && exit 0
  fi
fi

# ── Uncommitted changes check ─────────────────────────────────────────────────
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" -gt 0 ]; then
  echo -e "\n${RED}[ERR] Worktree heeft uncommitted changes ($DIRTY bestanden). Commit eerst.${NC}"
  exit 1
fi

# ── Overschakelen naar main en mergen ─────────────────────────────────────────
cd "$REPO_ROOT"

echo -e "\n${CYAN}Fetching origin...${NC}"
git fetch origin main --quiet

echo -e "${CYAN}Switching naar main...${NC}"
git checkout main

echo -e "${CYAN}Pulling latest main...${NC}"
git pull origin main --quiet

echo -e "\n${BOLD}Commits in '$BRANCH' (niet in main):${NC}"
git log "main..$BRANCH" --oneline | head -20

echo
read -r -p "Merge branch '$BRANCH' → main$([ "$SQUASH" = '--squash' ] && echo ' (squash)' || echo '')? [y/N] " CONFIRM
[[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && { git checkout - ; exit 0; }

if [ "$SQUASH" = "--squash" ]; then
  git merge --squash "$BRANCH"
  git commit -m "feat: merge $NAME ($BRANCH)"
else
  git merge --no-ff "$BRANCH" -m "Merge $NAME ($BRANCH) → main"
fi

echo -e "\n${GREEN}${BOLD}Merge geslaagd!${NC}"
echo -e "${DIM}Push naar remote met: git push origin main${NC}"
