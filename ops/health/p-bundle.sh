#!/usr/bin/env bash
# p-bundle 验收：插件构建产物可运行且与源码一致（对应 .pm/acceptance/p-bundle.feature）
set -euo pipefail
root="${PM_ROOT:-$PWD}"
bundle="$root/plugin/bin/pm.mjs"

[ -f "$bundle" ] || { echo "缺少 $bundle（先运行 npm run build:plugin）" >&2; exit 1; }
output=$(cd "$root" && node "$bundle" context) || { echo "pm.mjs context 运行失败" >&2; exit 1; }
grep -q "项目地图" <<<"$output" || { echo "pm.mjs context 输出里没有项目地图" >&2; exit 1; }
diff -r "$root/src/dashboard/client" "$root/plugin/bin/client" >/dev/null || { echo "plugin/bin/client 与源码不一致（重新运行 npm run build:plugin）" >&2; exit 1; }
