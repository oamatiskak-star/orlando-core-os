#!/bin/zsh
# Setup Mac Mini 2 — kloont alle repos van oamatiskak-star naar ~/Github via SSH
# Eenmalig uitvoeren op de tweede Mac Mini
# Vereiste: SSH key aangemaakt en toegevoegd aan github.com/settings/ssh

REPOS_DIR="$HOME/Github"
GITHUB_USER="oamatiskak-star"

# SSH kloon URLs (werkt ook in launchd / non-interactieve sessies)
declare -A REPOS
REPOS=(
  ["orlando-core-os"]="git@github.com:oamatiskak-star/orlando-core-os.git"
  ["sterkbouw-saas-front"]="git@github.com:oamatiskak-star/sterkbouw-saas-front.git"
  ["sterkbouw-saas-back"]="git@github.com:oamatiskak-star/sterkbouw-saas-back.git"
  ["sterkbouw-saas-executor"]="git@github.com:oamatiskak-star/sterkbouw-saas-executor.git"
  ["strkbouw-calculatietool"]="git@github.com:oamatiskak-star/strkbouw-calculatietool.git"
  ["BouwplaatsApp"]="git@github.com:oamatiskak-star/bouwplaatsweb.git"
  ["sterkcalc-backups"]="git@github.com:oamatiskak-star/sterkcalc-backups.git"
)

mkdir -p "$REPOS_DIR"

echo "=== Setup Mac Mini 2 — Orlando GitHub Sync ==="

# 1. Test SSH verbinding
echo "--- SSH test ---"
ssh_result=$(ssh -T git@github.com 2>&1)
if echo "$ssh_result" | grep -q "successfully authenticated"; then
  echo "[OK] SSH verbinding met GitHub werkt"
else
  echo "[ERR] SSH verbinding mislukt: $ssh_result"
  echo "Voeg eerst je SSH key toe via: https://github.com/settings/ssh/new"
  echo "Public key: $(cat ~/.ssh/id_ed25519.pub 2>/dev/null || echo 'geen key gevonden — genereer met: ssh-keygen -t ed25519')"
  exit 1
fi

echo ""
echo "--- Repos klonen naar: $REPOS_DIR ---"

for name in "${(@k)REPOS}"; do
  url="${REPOS[$name]}"
  target="$REPOS_DIR/$name"
  if [[ -d "$target/.git" ]]; then
    echo "[SKIP]  $name — bestaat al"
  else
    echo "[CLONE] $name ..."
    git clone "$url" "$target" 2>&1
    [[ $? -eq 0 ]] && echo "[OK]    $name" || echo "[ERR]   $name — klonen mislukt"
  fi
done

# 2. Launchd auto-pull instellen
echo ""
echo "--- Launchd auto-pull installeren ---"
PLIST_SRC="$REPOS_DIR/orlando-core-os"  # sync scripts staan in orlando-core-os na pull
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_AGENTS/com.orlando.sync-pull.plist"

mkdir -p "$LAUNCH_AGENTS"

cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.orlando.sync-pull</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>/Users/$USER/Github/sync-pull.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/$USER/Github/.sync-launchd.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/$USER/Github/.sync-launchd-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>/Users/$USER</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>
PLIST_EOF

launchctl load "$PLIST" 2>&1 && echo "[OK] Launchd auto-pull actief (elke 5 min)"

chmod +x "$REPOS_DIR/sync-pull.sh" "$REPOS_DIR/sync-push.sh" 2>/dev/null

echo ""
echo "=== Mac Mini 2 setup compleet ==="
echo "Test met: ~/Github/sync-pull.sh"
