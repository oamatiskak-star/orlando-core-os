#!/usr/bin/env bash
# Upload secrets from a local env file to a GitHub repository as Actions secrets.
#
# Usage:
#   ./scripts/setup-gh-secrets.sh [--repo OWNER/REPO] [--env-file PATH] [--env ENV_NAME] [--dry-run]
#
# Defaults:
#   --env-file  .env.gh-secrets  (falls back to .env.local if the first is missing)
#   --repo      detected from the current git remote
#   --env       (none — sets repo-level secrets; pass to target an Environment)
#
# Env file format: one KEY=VALUE per line. Lines starting with # and blank lines
# are ignored. Values may be quoted with single or double quotes; surrounding
# quotes are stripped. Keys must match ^[A-Z_][A-Z0-9_]*$.

set -euo pipefail

REPO=""
ENV_FILE=""
ENV_NAME=""
DRY_RUN=0

usage() {
  sed -n '2,16p' "$0"
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)     REPO="${2:?--repo needs a value}"; shift 2 ;;
    --env-file) ENV_FILE="${2:?--env-file needs a value}"; shift 2 ;;
    --env)      ENV_NAME="${2:?--env needs a value}"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)  usage 0 ;;
    *) echo "unknown argument: $1" >&2; usage 1 ;;
  esac
done

command -v gh >/dev/null || { echo "gh CLI is required (https://cli.github.com)" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated. Run: gh auth login" >&2; exit 1; }

if [[ -z "$ENV_FILE" ]]; then
  if   [[ -f .env.gh-secrets ]]; then ENV_FILE=".env.gh-secrets"
  elif [[ -f .env.local      ]]; then ENV_FILE=".env.local"
  else
    echo "no env file found. Pass --env-file or create .env.gh-secrets" >&2
    exit 1
  fi
fi

[[ -f "$ENV_FILE" ]] || { echo "env file not found: $ENV_FILE" >&2; exit 1; }

if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
  [[ -n "$REPO" ]] || { echo "could not detect repo. Pass --repo OWNER/REPO" >&2; exit 1; }
fi

echo "Repo:     $REPO"
echo "Env file: $ENV_FILE"
[[ -n "$ENV_NAME" ]] && echo "Env:      $ENV_NAME (environment-scoped)"
[[ $DRY_RUN -eq 1 ]] && echo "Mode:     DRY RUN (no secrets will be set)"
echo

count=0
skipped=0
while IFS= read -r raw || [[ -n "$raw" ]]; do
  line="${raw%$'\r'}"
  [[ -z "${line//[[:space:]]/}" ]] && continue
  [[ "${line#"${line%%[![:space:]]*}"}" == \#* ]] && continue

  line="${line#export }"

  key="${line%%=*}"
  val="${line#*=}"

  key="${key#"${key%%[![:space:]]*}"}"
  key="${key%"${key##*[![:space:]]}"}"

  if [[ ! "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
    echo "skip (invalid key): $key"
    skipped=$((skipped+1))
    continue
  fi

  if [[ "$val" =~ ^\".*\"$ ]]; then val="${val:1:${#val}-2}"
  elif [[ "$val" =~ ^\'.*\'$ ]]; then val="${val:1:${#val}-2}"
  fi

  if [[ -z "$val" ]]; then
    echo "skip (empty value): $key"
    skipped=$((skipped+1))
    continue
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "would set: $key  (${#val} chars)"
  else
    args=(secret set "$key" --repo "$REPO" --body "$val")
    [[ -n "$ENV_NAME" ]] && args+=(--env "$ENV_NAME")
    if gh "${args[@]}" >/dev/null; then
      echo "set: $key"
    else
      echo "FAILED: $key" >&2
      exit 1
    fi
  fi
  count=$((count+1))
done < "$ENV_FILE"

echo
echo "Done. $count secret(s) processed, $skipped skipped."
