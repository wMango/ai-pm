#!/usr/bin/env bash
# p-repo 验收：项目仓库承载 .pm 目录（对应 .pm/acceptance/p-repo.feature）
set -euo pipefail
root="${PM_ROOT:-$PWD}"

[ -r "$root/.pm/pm.yaml" ] || { echo "缺少 $root/.pm/pm.yaml" >&2; exit 1; }
git -C "$root" ls-files --error-unmatch .pm/pm.yaml >/dev/null 2>&1 || { echo ".pm/pm.yaml 未被 git 跟踪" >&2; exit 1; }
for name in current.json last-run.log trusted-runners; do
  grep -qx "$name" "$root/.pm/.gitignore" || { echo ".pm/.gitignore 没有排除 $name" >&2; exit 1; }
done
