#!/usr/bin/env bash
# Backup helper voor één Supabase tabel via pg_dump.
# Gebruik:  scripts/backup-table.sh public.orchestrator_tasks
# Output:   backups/<schema>.<table>_<UTC-timestamp>.sql
#
# Vereist env:
#   SUPABASE_DB_URL   = postgres://...:.../postgres  (uit Supabase project settings)
# pg_dump moet beschikbaar zijn op het PATH.

set -euo pipefail

table="${1:-}"
if [[ -z "$table" ]]; then
  echo "usage: $0 <schema.table>" >&2
  exit 2
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL niet gezet" >&2
  exit 2
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump niet gevonden op PATH" >&2
  exit 2
fi

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out_dir="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$out_dir"
safe_name="${table//./_}"
out_file="$out_dir/${safe_name}_${ts}.sql"

echo "→ Backup $table → $out_file"
pg_dump --no-owner --no-privileges --data-only --column-inserts \
  --table="$table" \
  "$SUPABASE_DB_URL" > "$out_file"

echo "✓ Klaar ($(wc -l < "$out_file") regels)"
