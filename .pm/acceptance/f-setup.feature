# language: zh-CN
# f-setup：接入 OpenCode / DeepSeek Harness（功能层，待人确认）
# 补挂现有测试：tests/commands/setup.test.ts

功能: 一条命令接入其他代理平台

  场景: 接入 OpenCode
    当 我运行 pm setup opencode
    那么 项目里装好 OpenCode 插件和 pm Skill，路径已写好，不用我手改
    并且 这个插件在会话空闲时记 token，在会话开始时注入项目摘要
    并且 在没有 .pm/ 的项目里它什么都不做

  场景: 接入 DeepSeek Harness
    当 我运行 pm setup deepseek
    那么 装好 pm Skill，并在 AGENTS.md 里写入一段说明，重复运行只更新这一段

  场景: 装到用户目录与错误提示
    当 我加上 --global
    那么 文件写到用户主目录下，而不是当前项目
    当 我写了不支持的平台名
    那么 命令失败并列出支持的平台
