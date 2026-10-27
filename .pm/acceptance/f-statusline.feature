# language: zh-CN
# f-statusline：在 Claude Code 状态栏看到一行项目摘要（功能层，待人确认）
# 测试：tests/live/statusline.test.ts

功能: 写代码时，状态栏一直显示项目现在怎么样

  场景: 一条命令接入状态栏
    当 我在项目里运行 pm setup statusline
    那么 本项目的 .claude/settings.local.json 里配好了状态栏命令
    并且 如果我已经配置了别的状态栏，它不会被覆盖，而是告诉我怎么手动接入

  场景: 状态栏显示一行摘要
    假如 项目已用 ai-pm 管理
    当 Claude Code 刷新状态栏
    那么 一行里能看到：生效数/总数、当前模块、按杠杆排第一的下一步
    并且 有待复核或卡住的模块时，显示它们的数量
    并且 模块名里的换行和终端控制字符被去掉，太长的名字被截短

  场景: 不打扰没接入的项目
    假如 当前目录不是 ai-pm 管理的项目，或者 pm.yaml 有错
    当 Claude Code 刷新状态栏
    那么 状态栏不显示 ai-pm 的内容，也不报错
