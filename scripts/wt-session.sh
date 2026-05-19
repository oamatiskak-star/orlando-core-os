#!/usr/bin/env bash
# wt-session.sh — Registreert actieve Claude sessies per worktree
# Gebruik: wt-session.sh mark <name> <machine>   → registreer sessie
#          wt-session.sh unmark <name>            → verwijder sessie
#          wt-session.sh list                     → toon actieve sessies
#          wt-session.sh check <name>             → controleer of bezet
set -euo pipefail

SESSION_FILE="${HOME}/.orlando-wt-sessions.json"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

# Initialiseren als niet aanwezig
[ -f "$SESSION_FILE" ] || echo '{"sessions":{}}' > "$SESSION_FILE"

CMD="${1:-list}"
NAME="${2:-}"
MACHINE="${3:-CLI-L}"

case "$CMD" in
  mark)
    [ -z "$NAME" ] && { echo -e "${RED}Gebruik: wt-session.sh mark <name> [CLI-L|CLI-R]${NC}"; exit 1; }
    STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    PID="$$"
    # Check dubbele sessie
    EXISTING=$(python3 -c "
import json,sys
d=json.load(open('$SESSION_FILE'))
s=d.get('sessions',{}).get('$NAME',{})
print(s.get('machine','') + '|' + str(s.get('pid','')) if s else '')
" 2>/dev/null || echo "")
    if [ -n "$EXISTING" ]; then
      EMACHINE="${EXISTING%%|*}"
      EPID="${EXISTING##*|}"
      echo -e "${YELLOW}[WARN]${NC} Worktree '$NAME' heeft al een sessie op $EMACHINE (PID $EPID)"
      read -r -p "Overschrijven? [y/N] " CONFIRM
      [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && { echo "Geannuleerd."; exit 0; }
    fi
    python3 -c "
import json
d=json.load(open('$SESSION_FILE'))
d.setdefault('sessions',{})['$NAME']={
  'machine':'$MACHINE',
  'startedAt':'$STARTED',
  'pid':$PID
}
json.dump(d,open('$SESSION_FILE','w'),indent=2)
print('Session geregistreerd voor $NAME op $MACHINE')
"
    ;;

  unmark)
    [ -z "$NAME" ] && { echo -e "${RED}Gebruik: wt-session.sh unmark <name>${NC}"; exit 1; }
    python3 -c "
import json
d=json.load(open('$SESSION_FILE'))
removed=d.get('sessions',{}).pop('$NAME',None)
json.dump(d,open('$SESSION_FILE','w'),indent=2)
print('Session verwijderd.' if removed else 'Geen sessie gevonden voor $NAME.')
"
    ;;

  check)
    [ -z "$NAME" ] && { echo -e "${RED}Gebruik: wt-session.sh check <name>${NC}"; exit 1; }
    python3 -c "
import json,sys
d=json.load(open('$SESSION_FILE'))
s=d.get('sessions',{}).get('$NAME')
if s:
    print(f'BEZET: {s[\"machine\"]} (PID {s[\"pid\"]}) since {s[\"startedAt\"]}')
    sys.exit(1)
else:
    print('VRIJ')
    sys.exit(0)
"
    ;;

  list)
    echo -e "\n${BOLD}${CYAN}Actieve Claude Sessies${NC}"
    echo -e "─────────────────────────────────────────────"
    python3 -c "
import json
d=json.load(open('$SESSION_FILE'))
sessions=d.get('sessions',{})
if not sessions:
    print('  Geen actieve sessies.')
else:
    for name,s in sessions.items():
        m=s.get('machine','?')
        p=s.get('pid','?')
        t=s.get('startedAt','?')
        print(f'  {name:<22} {m:<8} PID:{p:<8} {t}')
"
    echo
    ;;

  *)
    echo "Gebruik: wt-session.sh [mark|unmark|check|list] <args>"
    exit 1
    ;;
esac
