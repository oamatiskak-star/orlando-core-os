#!/usr/bin/env bash
#
# Start Google Chrome met een remote-debugging-poort zodat de affiliate
# auto-filler (local-agent/src/affiliate-autofill.ts) er via CDP aan kan haken.
#
# Chrome 136+ (jij hebt 149) WEIGERT remote-debugging op het standaardprofiel,
# dus we gebruiken een aparte profielmap (~/.orlando-chrome-debug). Met
# --copy-logins wordt je hoofdprofiel één keer gekopieerd (cookies/sessies komen
# mee, want dezelfde macOS-gebruiker = dezelfde Keychain-sleutel).
#
# Gebruik:
#   bash scripts/launch-chrome-autofill.sh                # schoon debug-profiel (log in waar nodig)
#   bash scripts/launch-chrome-autofill.sh --copy-logins  # eenmalig je hoofd-logins kopiëren
#   PORT=9333 bash scripts/launch-chrome-autofill.sh      # andere poort
set -euo pipefail

PORT="${PORT:-9222}"
DEBUG_DIR="$HOME/.orlando-chrome-debug"
DEFAULT_DIR="$HOME/Library/Application Support/Google/Chrome"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [[ ! -x "$CHROME" ]]; then
  echo "Google Chrome niet gevonden op: $CHROME" >&2
  exit 1
fi

if [[ "${1:-}" == "--copy-logins" && ! -d "$DEBUG_DIR" ]]; then
  echo "Eenmalig je hoofdprofiel → debug-profiel kopiëren (logins komen mee)..."
  echo "Chrome wordt eerst afgesloten voor een schone kopie."
  osascript -e 'quit app "Google Chrome"' 2>/dev/null || true
  sleep 2
  mkdir -p "$DEBUG_DIR"
  # caches uitsluiten = veel sneller; cookies/Login Data/Local State komen wel mee
  rsync -a --delete \
    --exclude 'Default/Cache' --exclude 'Default/Code Cache' --exclude 'Default/GPUCache' \
    --exclude 'Default/Service Worker/CacheStorage' --exclude 'ShaderCache' --exclude 'GrShaderCache' \
    "$DEFAULT_DIR/" "$DEBUG_DIR/"
  echo "Kopie klaar."
fi

echo "Start Chrome op debug-poort $PORT met profiel: $DEBUG_DIR"
echo "Laat dit venster open staan en draai daarna de auto-filler in een andere terminal:"
echo "  cd \"$HOME/Github/orlando-core-os/local-agent\" && npx ts-node --transpile-only src/affiliate-autofill.ts"
echo
exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$DEBUG_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --start-maximized
