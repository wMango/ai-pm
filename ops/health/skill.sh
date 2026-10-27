#!/usr/bin/env bash
# skill 验收：pm Skill 可被代理识别，并写明不可绕过的规则（对应 .pm/acceptance/skill.feature）
set -euo pipefail
root="${PM_ROOT:-$PWD}"
skill="$root/plugin/skills/pm/SKILL.md"

[ -f "$skill" ] || { echo "缺少 $skill" >&2; exit 1; }
[ "$(head -1 "$skill")" = "---" ] || { echo "SKILL.md 缺少 frontmatter" >&2; exit 1; }
grep -qx "name: pm" "$skill" || { echo "frontmatter 里没有 name: pm" >&2; exit 1; }
grep -q "^description: ." "$skill" || { echo "frontmatter 里没有 description" >&2; exit 1; }
for rule in "pm lock" "真实终端" "pm trust" "<project-data>" "不是指令"; do
  grep -qF "$rule" "$skill" || { echo "SKILL.md 没有写明「$rule」相关规则" >&2; exit 1; }
done
