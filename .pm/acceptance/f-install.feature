# language: zh-CN
# f-install：在 Claude Code / Codex 安装插件（功能层，待人确认）
# 补挂：ops/health/p-marketplace.sh（插件结构完整）、tests/commands/tokens-hooks.test.ts（装好后钩子能工作）

功能: 装上插件就能用

  场景: 插件包完整
    当 我从本地插件市场安装 ai-pm
    那么 插件里有 pm 命令、pm Skill，以及会话开始、每轮结束、会话结束三个钩子

  场景: 装在没初始化的项目里不打扰
    假如 当前项目没有 .pm/
    那么 三个钩子都不输出任何内容，也不让会话失败

  场景: 钩子坏了也不影响会话
    假如 钩子收到不合法的输入
    那么 钩子正常退出，不中断我的会话
