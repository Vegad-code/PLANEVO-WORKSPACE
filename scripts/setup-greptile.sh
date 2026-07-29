#!/usr/bin/env bash
# One-time Greptile auth for this machine. Does not print or commit the key.
set -euo pipefail

export PATH="/Users/jabbo/.local/bin:/Users/jabbo/.local/opt/node-v22.22.3/bin:$PATH"

if ! command -v greptile >/dev/null 2>&1; then
  echo "Installing greptile CLI…"
  npm install -g greptile@latest
  ln -sf "$(npm prefix -g)/bin/greptile" "$HOME/.local/bin/greptile"
fi

mkdir -p "$HOME/.greptile"
chmod 700 "$HOME/.greptile"

echo "Paste your Greptile API key (input hidden), then Enter:"
# shellcheck disable=SC2162
IFS= read -r -s key
echo
if [[ -z "$key" ]]; then
  echo "No key entered; aborted."
  exit 1
fi

umask 077
printf '%s' "$key" > "$HOME/.greptile/api_key"
chmod 600 "$HOME/.greptile/api_key"
printf '%s' "$key" | greptile login --api-key
unset key

greptile settings set telemetry false >/dev/null 2>&1 || true
echo "Greptile authenticated. whoami:"
greptile whoami
echo
echo "Optional: also add GREPTILE_API_KEY=… to apps/web/.env.local (gitignored)."
echo "GitHub PR auto-review still needs the repo enabled at https://app.greptile.com/review/github"
