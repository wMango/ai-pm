#!/usr/bin/env bash
# git-tool 验收：本机 git 可用，能读出仓库根目录与提交记录（对应 .pm/acceptance/git-tool.feature）
set -euo pipefail
root="${PM_ROOT:-$PWD}"

command -v git >/dev/null || { echo "PATH 上找不到 git" >&2; exit 1; }
(cd "$root" && git rev-parse --show-toplevel >/dev/null 2>&1) || { echo "$root 不在 git 仓库里" >&2; exit 1; }
(cd "$root" && git log -1 --format=%H >/dev/null 2>&1) || { echo "读不到提交记录（仓库还没有提交？）" >&2; exit 1; }
