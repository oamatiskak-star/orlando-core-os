#!/usr/bin/env bash
# wt-new.sh — Voeg een nieuwe worktree toe
# Gebruik: wt-new.sh <worktree-naam> <branch-naam>
# Voorbeeld: wt-new.sh cfo-engine feature/cfo-engine
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREES_BASE="${HOME}/Worktrees"
SESSION_FILE="${HOME}/.orlando-wt-sessions.json"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

NAME="${1:-}"
BRANCH="${2:-}"

if [ -z "$NAME" ] || [ -z "$BRANCH" ]; then
  echo -e "${RED}Gebruik: wt-new.sh <naam> <branch>${NC}"
  echo "Voorbeeld: wt-new.sh cfo-engine feature/cfo-engine"
  exit 1
fi

# ── Validatie ─────────────────────────────────────────────────────────────────
# Blokkeer ongeldige branch namen
if [[ "$BRANCH" == *" "* ]]; then
  echo -e "${RED}Ongeldige branch naam (geen spaties toegestaan): $BRANCH${NC}"; exit 1
fi

# Branch prefix validatie
if [[ "$BRANCH" != feature/* && "$BRANCH" != fix/* && "$BRANCH" != infra/* && "$BRANCH" != chore/* ]]; then
  echo -e "${YELLOW}[WARN] Branch heeft geen standaard prefix (feature/, fix/, infra/, chore/).${NC}"
  read -r -p "Toch doorgaan? [y/N] " CONFIRM
  [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && exit 0
fi

PATH_="$WORKTREES_BASE/$NAME"

cd "$REPO_ROOT"

# Dubbele worktree check
if git worktree list --porcelain | grep -q "worktree $PATH_$"; then
  echo -e "${YELLOW}[WARN] Worktree '$NAME' bestaat al op $PATH_${NC}"; exit 1
fi

if [ -d "$PATH_" ]; then
  echo -e "${RED}[ERR] Map $PATH_ bestaat al maar is geen worktree.${NC}"; exit 1
fi

# Dubbele branch check
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo -e "${YELLOW}[WARN] Branch '$BRANCH' bestaat al.${NC}"
  read -r -p "Bestaande branch gebruiken? [y/N] " CONFIRM
  if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
    git worktree add "$PATH_" "$BRANCH"
  else
    exit 0
  fi
else
  git worktree add -b "$BRANCH" "$PATH_" HEAD
fi

# ── Session file initialiseren ────────────────────────────────────────────────
[ -f "$SESSION_FILE" ] || echo '{"sessions":{}}' > "$SESSION_FILE"

echo -e "\n${GREEN}${BOLD}Worktree aangemaakt!${NC}"
echo -e "  Pad    : $PATH_"
echo -e "  Branch : $BRANCH"
echo -e "\nStarten:"
echo -e "  cd $PATH_"
echo -e "  scripts/wt-session.sh mark $NAME CLI-L"
echo -e "  claude"
