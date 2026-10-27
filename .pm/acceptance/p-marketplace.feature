# language: zh-CN
# p-marketplace（本地插件市场 .claude-plugin）健康检查
# 补挂：ops/health/p-marketplace.sh

功能: 本地插件市场指向完整的 ai-pm 插件

  场景: marketplace.json 列出 ai-pm，指向的目录里有 plugin.json 且 name 为 ai-pm
  场景: hooks.json 声明 SessionStart、Stop、SessionEnd 三个钩子，都调用 bin/pm.mjs
  场景: 插件目录里有 bin/pm.mjs 和 skills/pm/SKILL.md
