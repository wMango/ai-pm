# language: zh-CN
# cost-calc（token 记账）的接口契约；支撑 f-cost、f-autorun
# 补挂现有测试：tests/cost-blueprint.test.ts、tests/commands/tokens-hooks.test.ts、tests/transcript-formats.test.ts

功能: 解析会话记录、增量记账、汇总成本

  场景: Claude Code 记录按消息去重；Codex 取最后的累计值；pm-usage 行按消息 id 去重、忽略非法值
  场景: processed 口径不含缓存读取，all 口径全含
  场景: pm record 增量记到当前模块，未声明模块记到 unassigned，读不了记录时不记并警告
  场景: 重复记录不重复计数
  场景: 成本报告按节点汇总 token 与天数，算出沉没与卡住，未知节点的流水只报告不计入
