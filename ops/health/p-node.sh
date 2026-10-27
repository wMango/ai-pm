#!/usr/bin/env bash
# p-node 验收：本机 Node.js 运行时可用（对应 .pm/acceptance/p-node.feature）
set -euo pipefail
readonly MIN_MAJOR=20

command -v node >/dev/null || { echo "PATH 上找不到 node" >&2; exit 1; }
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge "$MIN_MAJOR" ] || { echo "node 主版本 $major 低于 $MIN_MAJOR" >&2; exit 1; }
