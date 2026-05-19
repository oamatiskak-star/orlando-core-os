#!/usr/bin/env bash
# wt-bootstrap-cli-r.sh — Eenmalige worktree setup op CLI-R
# Uitvoeren op CLI-R: bash ~/Github/orlando-core-os/scripts/wt-bootstrap-cli-r.sh
set -euo pipefail

REPO_ROOT="${HOME}/Github/orlando-core-os"
WORKTREES_BASE="${HOME}/Worktrees"
SESSION_FILE="${HOME}/.orlando-wt-sessions.json"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

echo -e "\n${BOLD}${CYAN}CLI-R — Worktree Bootstrap${NC}"
echo -e "${DIM}Repo: $REPO_ROOT${NC}\n"

# ── Repo aanwezig? ────────────────────────────────────────────────────────────
if [ ! -d "$REPO_ROOT/.git" ]; then
  echo -e "${RED}[ERR] Repo niet gevonden op $REPO_ROOT${NC}"
  echo -e "Kloon eerst: git clone git@github.com:oamatiskak-star/orlando-core-os.git $REPO_ROOT"
  exit 1
fi

# ── Pull latest ───────────────────────────────────────────────────────────────
echo -e "${CYAN}[1/2] Pulling latest main...${NC}"
cd "$REPO_ROOT"
git fetch origin main --quiet
git pull origin main --rebase --quiet
echo -e "${GREEN}[OK] Up to date: $(git log -1 --pretty=format:'%h %s')${NC}"

# ── Worktrees aanmaken ────────────────────────────────────────────────────────
echo -e "\n${CYAN}[2/2] Worktrees aanmaken...${NC}"
bash "$REPO_ROOT/scripts/wt-setup.sh"

# ── CLI-R machine markeren in session file ────────────────────────────────────
[ -f "$SESSION_FILE" ] || echo '{"sessions":{}}' > "$SESSION_FILE"

echo -e "\n${GREEN}${BOLD}CLI-R bootstrap klaar.${NC}"
echo -e "\nCLI-R worktrees staan op: ${BOLD}$WORKTREES_BASE/${NC}"
echo -e "\nWerkflow op CLI-R:"
echo -e "  ${DIM}cd ~/Worktrees/youtube-engine${NC}"
echo -e "  ${DIM}bash ~/Github/orlando-core-os/scripts/wt.sh session mark youtube-engine CLI-R${NC}"
echo -e "  ${DIM}claude${NC}"
