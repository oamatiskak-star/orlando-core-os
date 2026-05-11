#!/bin/zsh
# Sync Pull — pulled alle repos in ~/Github van GitHub
# Draai op beide Mac Mini's om up-to-date te blijven

REPOS_DIR="$HOME/Github"
LOG="$REPOS_DIR/.sync-pull.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "" >> "$LOG"
echo "[$TIMESTAMP] sync-pull gestart op $(hostname)" >> "$LOG"

for repo in "$REPOS_DIR"/*/; do
  [[ ! -d "$repo/.git" ]] && continue
  name=$(basename "$repo")
  branch=$(git -C "$repo" branch --show-current 2>/dev/null)

  # Sla uncommitted wijzigingen over — nooit forceren
  changes=$(git -C "$repo" status --short 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$changes" -gt 0 ]]; then
    echo "  [SKIP] $name — $changes uncommitted wijzigingen" | tee -a "$LOG"
    continue
  fi

  result=$(git -C "$repo" pull origin "$branch" 2>&1)
  if echo "$result" | grep -q "Already up to date"; then
    echo "  [OK]   $name — al up to date" | tee -a "$LOG"
  elif echo "$result" | grep -q "error\|fatal"; then
    echo "  [ERR]  $name — $result" | tee -a "$LOG"
  else
    echo "  [PULL] $name — updates opgehaald" | tee -a "$LOG"
    echo "         $result" >> "$LOG"
  fi
done

echo "[$TIMESTAMP] sync-pull klaar" >> "$LOG"
