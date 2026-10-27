# language: zh-CN
# context-gen（AI 上下文摘要）的接口契约；支撑 f-next、f-inject
# 补挂现有测试：tests/commands/tokens-hooks.test.ts、tests/commands/hardening.test.ts

功能: 生成给 AI 的项目摘要

  场景: pm context 汇总各目标进度、下一步和待复核项
  场景: 没有 .pm/ 时什么都不输出
  场景: 名字被压平，整段放在 <project-data> 围栏里
