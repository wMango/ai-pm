#!/usr/bin/env bash
# agent-platform 验收：本机至少装有一个受支持的代理平台（对应 .pm/acceptance/agent-platform.feature）
set -euo pipefail

for cli in claude codex opencode; do
  command -v "$cli" >/dev/null && exit 0
done
[ -x "$HOME/.claude/local/claude" ] && exit 0
echo "PATH 上找不到 claude、codex 或 opencode" >&2
exit 1
