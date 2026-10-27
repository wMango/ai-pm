# language: zh-CN
# hook-adapter（钩子适配）的接口契约；支撑 f-install、f-inject、f-autorun
# 补挂现有测试：tests/commands/tokens-hooks.test.ts、tests/commands/hardening.test.ts、tests/commands/setup.test.ts

功能: 把代理平台的事件转成 pm 操作

  场景: session-start 注入上下文；stop 记 token 并刷新、不跑测试；session-end --sync 记账、验收、刷新
  场景: 未信任 runner 时不自动跑测试；pm init 生成的 runner 自动信任，信任文件不进仓库
  场景: 在子目录里也能找到 .pm/；在没有 .pm/ 的项目里静默；坏输入不让会话失败
  场景: session-end 失败写进 last-run.log
  场景: OpenCode 插件在空闲时记 token、注入上下文，在无 .pm/ 的项目里静默
