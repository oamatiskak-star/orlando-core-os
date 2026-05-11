#!/bin/zsh
# Sync Push — commit en push vanuit een specifieke repo
# Gebruik: ./sync-push.sh <repo-naam> "commit bericht"
# Voorbeeld: ./sync-push.sh orlando-core-os "feat: auth module toegevoegd"

REPOS_DIR="$HOME/Github"
LOG="$REPOS_DIR/.sync-push.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

if [[ -z "$1" || -z "$2" ]]; then
  echo "Gebruik: $0 <repo-naam> \"commit bericht\""
  echo "Beschikbare repos:"
  for r in "$REPOS_DIR"/*/; do
    [[ -d "$r/.git" ]] && echo "  $(basename "$r")"
  done
  exit 1
fi

REPO="$REPOS_DIR/$1"
MESSAGE="$2"

if [[ ! -d "$REPO/.git" ]]; then
  echo "[ERR] Repo niet gevonden: $REPO"
  exit 1
fi

branch=$(git -C "$REPO" branch --show-current 2>/dev/null)
changes=$(git -C "$REPO" status --short 2>/dev/null | wc -l | tr -d ' ')

if [[ "$changes" -eq 0 ]]; then
  echo "[INFO] Geen wijzigingen in $1"
  exit 0
fi

echo "" >> "$LOG"
echo "[$TIMESTAMP] push $1 vanaf $(hostname)" >> "$LOG"

git -C "$REPO" add -A >> "$LOG" 2>&1
git -C "$REPO" commit -m "$MESSAGE" >> "$LOG" 2>&1
result=$(git -C "$REPO" push origin "$branch" 2>&1)

if echo "$result" | grep -q "error\|fatal"; then
  echo "[ERR]  $1 — push mislukt: $result" | tee -a "$LOG"
  exit 1
else
  echo "[PUSH] $1 — gepushed naar $branch" | tee -a "$LOG"
fi
