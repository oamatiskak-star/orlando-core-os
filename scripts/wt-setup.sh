#!/usr/bin/env bash
# wt-setup.sh — Initialiseert alle Git Worktrees voor Orlando Core OS
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREES_BASE="${HOME}/Worktrees"
SESSION_FILE="${HOME}/.orlando-wt-sessions.json"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }
head_()  { echo -e "\n${BOLD}${CYAN}$*${NC}"; }

# ── Worktree definitie: "directory-naam:branch-naam" ─────────────────────────
WORKTREES=(
  "frontend-ui:feature/frontend-ui"
  "legal-os:feature/legal-os"
  "mail-engine:feature/mail-engine"
  "workflow-engine:feature/workflow-engine"
  "youtube-engine:feature/youtube-engine"
  "executor-core:feature/executor-core"
  "finance-os:feature/finance-os"
  "admin-os:feature/admin-os"
  "upload-workers:fix/upload-recovery"
  "retry-fixer:fix/retry-recovery"
  "media-workers:infra/worker-node"
  "ocr-workers:infra/local-ai"
  "agent-core:feature/agent-core"
  "monitoring-system:feature/monitoring-system"
  "queue-system:fix/queue-system"
  "scheduler-system:feature/scheduler-system"
)

head_ "Orlando Core OS — Git Worktree Setup"
info "Repo root : $REPO_ROOT"
info "Worktrees : $WORKTREES_BASE"
echo

mkdir -p "$WORKTREES_BASE"
cd "$REPO_ROOT"

CREATED=0; SKIPPED=0; FAILED=0

for entry in "${WORKTREES[@]}"; do
  name="${entry%%:*}"
  branch="${entry##*:}"
  path="$WORKTREES_BASE/$name"

  # Al aanwezig als worktree?
  if git worktree list --porcelain | grep -q "worktree $path$"; then
    warn "Worktree '$name' bestaat al — skip"
    (( SKIPPED++ )) || true
    continue
  fi

  # Map bestaat maar is géén worktree?
  if [ -d "$path" ] && [ ! -f "$path/.git" ]; then
    warn "Map $path bestaat maar is geen worktree — skip (verwijder handmatig)"
    (( SKIPPED++ )) || true
    continue
  fi

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    info "Branch '$branch' bestaat → worktree koppelen"
    if git worktree add "$path" "$branch" 2>/dev/null; then
      ok "Worktree '$name' gekoppeld aan branch '$branch'"
      (( CREATED++ )) || true
    else
      err "Worktree '$name' aanmaken mislukt"
      (( FAILED++ )) || true
    fi
  else
    info "Nieuwe branch '$branch' + worktree op $path"
    if git worktree add -b "$branch" "$path" HEAD 2>/dev/null; then
      ok "Worktree '$name' aangemaakt (branch: $branch)"
      (( CREATED++ )) || true
    else
      err "Worktree '$name' aanmaken mislukt"
      (( FAILED++ )) || true
    fi
  fi
done

# ── Session tracking file initialiseren ──────────────────────────────────────
if [ ! -f "$SESSION_FILE" ]; then
  echo '{"sessions":{}}' > "$SESSION_FILE"
  info "Session tracker aangemaakt: $SESSION_FILE"
fi

# ── Conclusie ─────────────────────────────────────────────────────────────────
echo
head_ "Resultaat"
echo -e "  ${GREEN}Aangemaakt :${NC} $CREATED"
echo -e "  ${YELLOW}Overgeslagen:${NC} $SKIPPED"
echo -e "  ${RED}Mislukt    :${NC} $FAILED"
echo
info "Run 'scripts/wt.sh status' voor een overzicht van alle worktrees."
