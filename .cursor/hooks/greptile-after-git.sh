#!/usr/bin/env bash
# After successful git commit/push, run Greptile and inject findings for the agent.
# Never prints or commits API keys. Auth via greptile login, GREPTILE_API_KEY, or ~/.greptile/api_key.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.command // empty')"
output="$(printf '%s' "$input" | jq -r '.output // empty')"

# Matcher should already filter, but keep a hard guard.
if ! printf '%s' "$command" | rg -q '(^|[[:space:];|&])git[[:space:]]+(commit|push)\b'; then
  printf '%s\n' '{}'
  exit 0
fi

if [[ "${GREPTILE_SKIP:-}" == "1" ]]; then
  printf '%s\n' '{"additional_context":"Greptile skipped (GREPTILE_SKIP=1)."}'
  exit 0
fi

# Infer failure from common git messages (afterShellExecution has no exit code field).
if printf '%s' "$output" | rg -qi '^(error:|fatal:)|rejected|failed to push|nothing to commit|hook declined|commit.*aborted'; then
  printf '%s\n' '{}'
  exit 0
fi

# Load API key without echoing it.
load_api_key() {
  if [[ -n "${GREPTILE_API_KEY:-}" ]]; then
    return 0
  fi
  if [[ -f "$HOME/.greptile/api_key" ]]; then
    GREPTILE_API_KEY="$(tr -d '\r\n' < "$HOME/.greptile/api_key")"
    export GREPTILE_API_KEY
    return 0
  fi
  if [[ -f "$ROOT/apps/web/.env.local" ]]; then
    local line
    line="$(rg -m1 '^[[:space:]]*GREPTILE_API_KEY=' "$ROOT/apps/web/.env.local" || true)"
    if [[ -n "$line" ]]; then
      GREPTILE_API_KEY="${line#*=}"
      GREPTILE_API_KEY="${GREPTILE_API_KEY%\"}"
      GREPTILE_API_KEY="${GREPTILE_API_KEY#\"}"
      GREPTILE_API_KEY="${GREPTILE_API_KEY%\'}"
      GREPTILE_API_KEY="${GREPTILE_API_KEY#\'}"
      export GREPTILE_API_KEY
      return 0
    fi
  fi
  return 1
}

export PATH="/Users/jabbo/.local/bin:/Users/jabbo/.local/opt/node-v22.22.3/bin:$PATH"
GREPTILE_BIN="$(command -v greptile || true)"
if [[ -z "$GREPTILE_BIN" ]]; then
  jq -n --arg ctx 'Greptile CLI not found on PATH. Install with `npm install -g greptile@latest` and ensure ~/.local/bin is on PATH.' '{additional_context:$ctx}'
  exit 0
fi

auth_ok=0
if load_api_key; then
  auth_ok=1
else
  # whoami exits 0 even when signed out — check the message.
  whoami_out="$("$GREPTILE_BIN" whoami 2>&1 || true)"
  if ! printf '%s' "$whoami_out" | rg -qi 'not signed in|run `?greptile login'; then
    auth_ok=1
  fi
fi

if [[ "$auth_ok" -ne 1 ]]; then
  jq -n --arg ctx 'Greptile is not authenticated. Run `./scripts/setup-greptile.sh` (or `greptile login --api-key`). Do not paste the key into chat.' '{additional_context:$ctx}'
  exit 0
fi

# Prefer reviewing against main.
base_branch="main"
if git show-ref --verify --quiet refs/remotes/origin/main; then
  base_branch="main"
elif git show-ref --verify --quiet refs/remotes/origin/master; then
  base_branch="master"
fi

# Skip duplicate review for the same HEAD if one already completed.
if "$GREPTILE_BIN" review status >/dev/null 2>&1; then
  jq -n --arg sha "$(git rev-parse --short HEAD 2>/dev/null || echo HEAD)" \
    '{additional_context:("Greptile already has a completed review for " + $sha + ". Skipping duplicate run.")}'
  exit 0
fi

review_log="$(mktemp -t greptile-review.XXXXXX)"
cleanup() { rm -f "$review_log"; }
trap cleanup EXIT

set +e
"$GREPTILE_BIN" review --agent --branch "$base_branch" >"$review_log" 2>&1
review_status=$?
set -e

# Cap context size so the agent prompt stays usable.
review_body="$(
  python3 -c 'from pathlib import Path; import sys; text=Path(sys.argv[1]).read_text(errors="replace").strip(); max_chars=12000; print(text if len(text)<=max_chars else text[:max_chars]+"\n…[truncated]")' "$review_log"
)"

if [[ "$review_status" -ne 0 && -z "$review_body" ]]; then
  jq -n --arg code "$review_status" \
    '{additional_context:("Greptile review failed (exit " + $code + "). Check `greptile whoami` and API key setup.")}'
  exit 0
fi

jq -n \
  --arg body "$review_body" \
  --arg cmd "$command" \
  '{additional_context:("Greptile review after `" + $cmd + "`:\n\n" + $body + "\n\nAddress valid findings before considering the change done.")}'
exit 0
