# language: zh-CN
# f-cost：看到各模块的 token 成本（功能层，待人确认）
# 补挂现有测试：tests/cost-blueprint.test.ts、tests/commands/tokens-hooks.test.ts、tests/transcript-formats.test.ts

功能: 看到时间和 token 花在了哪些模块上（只展示，不计入进度）

  场景: token 记到当时在做的模块上
    假如 我用 pm start 声明了当前模块
    当 会话的 token 被记录
    那么 这次会话新增的 token 记到这个模块上，重复记录不会重复计数
    并且 还没声明模块时花的 token 记到「未分配」

  场景: 识别不同代理平台的会话记录
    那么 Claude Code 的同一条消息分多行写入时只算一次
    并且 Codex 取最后一次累计总量，而不是把每次事件相加
    并且 默认口径不含缓存读取，可以改成全部计入

  场景: 成本视图告诉我钱花得值不值
    当 我看成本视图
    那么 每个模块显示花了多少 token、从开始到现在多少天
    并且 花在还没生效的模块上的 token 单独标为「沉没」
    并且 进行中超过 5 天的模块标为「卡住」
