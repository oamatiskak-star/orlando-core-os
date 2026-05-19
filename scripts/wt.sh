#!/usr/bin/env bash
# wt.sh — Orlando Core OS Worktree CLI
# Gebruik: ./scripts/wt.sh <commando> [args]
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; GREEN='\033[0;32m'; NC='\033[0m'

CMD="${1:-help}"
shift || true

case "$CMD" in
  setup)
    bash "$SCRIPTS_DIR/wt-setup.sh" "$@"
    ;;

  status|st)
    bash "$SCRIPTS_DIR/wt-status.sh" "$@"
    ;;

  new)
    bash "$SCRIPTS_DIR/wt-new.sh" "$@"
    ;;

  merge)
    bash "$SCRIPTS_DIR/wt-merge.sh" "$@"
    ;;

  clean|prune)
    bash "$SCRIPTS_DIR/wt-clean.sh" "$@"
    ;;

  session|sess)
    bash "$SCRIPTS_DIR/wt-session.sh" "$@"
    ;;

  open|cd)
    # Gebruik: eval $(scripts/wt.sh open frontend-ui)
    NAME="${1:-}"
    [ -z "$NAME" ] && { echo -e "${RED}Gebruik: eval \$(scripts/wt.sh open <naam>)${NC}"; exit 1; }
    TARGET="${HOME}/Worktrees/$NAME"
    if [ ! -d "$TARGET" ]; then
      echo -e "echo 'Worktree $NAME niet gevonden op $TARGET'"; exit 1
    fi
    echo "cd \"$TARGET\""
    ;;

  list|ls)
    cd "$SCRIPTS_DIR/.."
    git worktree list
    ;;

  help|--help|-h)
    echo -e "\n${BOLD}${CYAN}Orlando Core OS — Worktree CLI${NC}\n"
    echo -e "  ${GREEN}setup${NC}                  Initialiseer alle standaard worktrees"
    echo -e "  ${GREEN}status${NC} (st)             Toon alle worktrees + actieve sessies"
    echo -e "  ${GREEN}list${NC} (ls)               Git worktree list"
    echo -e "  ${GREEN}new${NC} <naam> <branch>     Maak nieuwe worktree aan"
    echo -e "  ${GREEN}merge${NC} <naam> [--squash] Merge worktree branch → main"
    echo -e "  ${GREEN}clean${NC} (prune)           Verwijder orphaned worktrees + stale sessies"
    echo -e "  ${GREEN}session mark${NC} <n> <m>    Registreer Claude sessie (m = CLI-L of CLI-R)"
    echo -e "  ${GREEN}session unmark${NC} <naam>   Sessie vrijgeven"
    echo -e "  ${GREEN}session list${NC}            Toon alle actieve sessies"
    echo -e "  ${GREEN}session check${NC} <naam>    Controleer of worktree bezet is"
    echo -e "  ${GREEN}open${NC} <naam>             Print cd-commando (gebruik met eval)"
    echo
    echo -e "${DIM}Voorbeeld workflow:${NC}"
    echo -e "  scripts/wt.sh setup"
    echo -e "  cd ~/Worktrees/frontend-ui"
    echo -e "  scripts/wt.sh session mark frontend-ui CLI-L"
    echo -e "  claude"
    echo -e "  # ... werk aan feature ..."
    echo -e "  scripts/wt.sh session unmark frontend-ui"
    echo -e "  scripts/wt.sh merge frontend-ui"
    echo
    ;;

  *)
    echo -e "Onbekend commando: $CMD — gebruik 'scripts/wt.sh help'"
    exit 1
    ;;
esac
