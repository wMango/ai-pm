#!/usr/bin/env bash
# test-tools 验收：runners 用到的测试工具都能运行（对应 .pm/acceptance/test-tools.feature）
set -euo pipefail
root="${PM_ROOT:-$PWD}"

command -v bash >/dev/null || { echo "PATH 上找不到 bash" >&2; exit 1; }
(cd "$root" && npx --no-install vitest --version >/dev/null 2>&1) || { echo "项目里的 vitest 无法运行（先 npm install）" >&2; exit 1; }
