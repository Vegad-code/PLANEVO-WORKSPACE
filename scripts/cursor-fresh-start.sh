#!/usr/bin/env bash
# Reclaim Cursor / dev cache space. Quit Cursor completely (Cmd+Q) before running.
set -euo pipefail

if pgrep -x "Cursor" >/dev/null 2>&1; then
  echo "Quit Cursor first (Cmd+Q), then rerun this script."
  exit 1
fi

echo "==> Cursor logs"
rm -rf "$HOME/Library/Application Support/Cursor/logs"/*

delete_all_but_last_sorted() {
  local dir="$1"
  local names=()
  while IFS= read -r name; do
    names+=("$name")
  done < <(ls -1 "$dir" | sort)
  local count=${#names[@]}
  if [ "$count" -le 1 ]; then
    return
  fi
  local i=0
  while [ "$i" -lt $((count - 1)) ]; do
    rm -rf "$dir/${names[$i]}"
    i=$((i + 1))
  done
}

echo "==> Old Cursor app caches (keeps current install)"
CACHED_DATA="$HOME/Library/Application Support/Cursor/CachedData"
if [ -d "$CACHED_DATA" ]; then
  delete_all_but_last_sorted "$CACHED_DATA"
fi

echo "==> Old cursor-agent CLI versions (keeps newest)"
VERSIONS_DIR="$HOME/Library/Application Support/Cursor/User/globalStorage/anysphere.cursor-agent-worker/agent-cli/.local/share/cursor-agent/versions"
if [ -d "$VERSIONS_DIR" ]; then
  delete_all_but_last_sorted "$VERSIONS_DIR"
fi

echo "==> Cursor chat/agent blob cache (clears in-app chat cache, not your code)"
STATE_DB="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
if [ -f "$STATE_DB" ]; then
  cp "$STATE_DB" "$STATE_DB.backup-$(date +%Y%m%d)"
  sqlite3 "$STATE_DB" "DELETE FROM cursorDiskKV WHERE key LIKE 'bubbleId:%' OR key LIKE 'agentKv:%' OR key LIKE 'checkpointId:%';"
  sqlite3 "$STATE_DB" "VACUUM;"
fi

echo "==> Stale workspace restore DBs (keeps PLANEVO primary workspace)"
WS_DIR="$HOME/Library/Application Support/Cursor/User/workspaceStorage"
for id in 45bf43e9209912e2ea73cc0197aee6fa 0f72cae22341676c3328003bc7b73c2a c6ec9281513fb5bad36f66201e600 744d6dc319b07fb9f8258a5a5af57518 7c45e8fd71726d39479da097ae3e824c; do
  rm -rf "$WS_DIR/$id"
done

echo "==> Old project caches (keeps PLANEVO)"
rm -rf "$HOME/.cursor/projects/Users-jabbo-M1plan"
rm -rf "$HOME/.cursor/projects/Users-jabbo-Aurno"
rm -rf "$HOME/.cursor/projects/var-folders-"*

echo "==> Codex / Claude caches"
rm -f "$HOME/.codex/logs_2.sqlite" "$HOME/.codex/logs_2.sqlite-wal" "$HOME/.codex/logs_2.sqlite-shm" 2>/dev/null || true
rm -rf "$HOME/.codex/archived_sessions" "$HOME/.codex/cache"
rm -rf "$HOME/.claude/file-history" "$HOME/.claude/telemetry" "$HOME/.claude/backups"

echo "==> PLANEVO build cache (rebuild with: npm run build --workspace=apps/web)"
rm -rf "/Users/jabbo/PLANEVO/apps/web/.next"

echo
echo "Done. Reopen Cursor. Run 'npm run dev' to rebuild .next if needed."
du -sh "$HOME/Library/Application Support/Cursor" "$HOME/.cursor" "$HOME/.codex" 2>/dev/null
