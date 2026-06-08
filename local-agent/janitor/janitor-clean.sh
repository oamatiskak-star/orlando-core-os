#!/bin/bash
# janitor-clean.sh — macOS opschoner (CCleaner-vervanger), VEILIGE categorieën.
#
# Default DRY-RUN: toont alleen wat er terug te winnen is. Met --apply wordt
# daadwerkelijk opgeruimd. Byte-boekhouding per categorie.
#
# Bewust conservatief:
#   - Docker: alleen dangling images + build cache + gestopte containers.
#     NIET 'docker system prune -a' (verwijdert images van je gestopte containers).
#     NIET volume prune (dataverlies-risico).
#   - GEEN wholesale ~/Library/Caches wipe (app-eigendom; kan apps breken/trager maken).
#   - Spotlight-index wordt nooit aangeraakt (herindex = trager).
#
# Gebruik: bash janitor-clean.sh [--apply]
set -u
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
HOME_DIR="${HOME}"
TOTAL_BEFORE=0
say() { printf '%s\n' "$*"; }
human() { awk -v b="$1" 'BEGIN{ s="B KB MB GB TB"; split(s,a," "); i=1; while(b>=1024 && i<5){b/=1024;i++} printf "%.1f %s", b, a[i] }'; }
dir_bytes() { [ -d "$1" ] && { du -sk "$1" 2>/dev/null | awk '{print $1*1024}'; } || echo 0; }

say "=== JANITOR macOS-cleaner ($([ $APPLY -eq 1 ] && echo APPLY || echo DRY-RUN)) op $(hostname) ==="
RECLAIM=0
note() { # naam, bytes, applycmd
  local name="$1" bytes="$2" cmd="$3"
  RECLAIM=$((RECLAIM + bytes))
  printf '  %-26s %12s' "$name" "$(human "$bytes")"
  if [ $APPLY -eq 1 ] && [ -n "$cmd" ]; then
    eval "$cmd" >/dev/null 2>&1 && printf '   -> opgeruimd' || printf '   -> (overgeslagen/fout)'
  fi
  printf '\n'
}

# 1) Docker (dangling images + build cache + gestopte containers)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DKR=$(docker system df --format '{{.Type}}\t{{.Reclaimable}}' 2>/dev/null)
  say "Docker reclaimable (df):"; echo "$DKR" | sed 's/^/    /'
  if [ $APPLY -eq 1 ]; then
    docker container prune -f >/dev/null 2>&1
    docker image prune -f     >/dev/null 2>&1
    docker builder prune -f   >/dev/null 2>&1
    say "    -> docker dangling images + build cache + gestopte containers opgeruimd"
    say "    (tip: 'docker image prune -a' geeft meer terug, maar verwijdert images van gestopte containers — handmatig checken)"
  fi
else
  say "Docker: niet bereikbaar (overslaan)"
fi

# 2) Caches die veilig regenereren
NPM=$(dir_bytes "$HOME_DIR/.npm")
note ".npm cache" "$NPM" "npm cache clean --force"
PNPM_N=$(command -v pnpm >/dev/null 2>&1 && echo 1 || echo 0)
[ "$PNPM_N" = "1" ] && note "pnpm store (prune)" "$(dir_bytes "$HOME_DIR/Library/pnpm/store")" "pnpm store prune"
if command -v brew >/dev/null 2>&1; then
  BC=$(dir_bytes "$(brew --cache 2>/dev/null)")
  note "homebrew cache" "$BC" "brew cleanup -s --prune=all"
fi
DD=$(dir_bytes "$HOME_DIR/Library/Developer/Xcode/DerivedData")
[ "$DD" -gt 0 ] && note "Xcode DerivedData" "$DD" "rm -rf \"$HOME_DIR/Library/Developer/Xcode/DerivedData/\"*"
IOS_SUP=$(dir_bytes "$HOME_DIR/Library/Developer/Xcode/iOS DeviceSupport")
[ "$IOS_SUP" -gt 0 ] && note "Xcode iOS DeviceSupport" "$IOS_SUP" "rm -rf \"$HOME_DIR/Library/Developer/Xcode/iOS DeviceSupport/\"*"

# 3) Prullenbak
TRASH=$(dir_bytes "$HOME_DIR/.Trash")
[ "$TRASH" -gt 0 ] && note "Prullenbak" "$TRASH" "rm -rf \"$HOME_DIR/.Trash/\"*"

# 4) Report-only (NIET auto-wissen): app-caches + logs
CACHES=$(dir_bytes "$HOME_DIR/Library/Caches")
LOGS=$(dir_bytes "$HOME_DIR/Library/Logs")
say "Alleen-rapport (niet auto-gewist, app-eigendom):"
say "    ~/Library/Caches   $(human "$CACHES")"
say "    ~/Library/Logs     $(human "$LOGS")"

say "---"
say "Veilig terug te winnen (excl. Docker-detail): $(human "$RECLAIM")"
[ $APPLY -eq 0 ] && say "DRY-RUN: er is niets gewist. Draai met --apply om op te ruimen."
