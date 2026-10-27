# language: zh-CN
# f-autorun：会话结束自动记 token、跑验收、刷新地图（功能层，待人确认）
# 补挂现有测试：tests/commands/tokens-hooks.test.ts、tests/commands/hardening.test.ts

功能: 会话结束后，项目地图自动更新

  场景: 每轮结束只记账和刷新
    当 AI 完成一轮回复
    那么 记录新增 token 并刷新 dashboard，不跑测试

  场景: 会话结束时跑验收
    假如 我已经用 pm trust 信任了本项目的运行命令
    当 会话结束
    那么 记录 token、运行验收测试、刷新 dashboard

  场景: 没信任或命令被改过就不自动跑测试
    假如 运行命令没被信任，或信任之后又被改动
    当 会话结束
    那么 只记 token 和刷新，不运行任何测试

  场景: 出错有记录、不打扰
    假如 会话结束时的后台处理失败
    那么 原因写进 .pm/last-run.log
    并且 记账文件里有损坏的行时，地图照样能生成
