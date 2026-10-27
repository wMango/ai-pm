# language: zh-CN
# setup-gen（平台接入生成）的接口契约；支撑 f-setup
# 补挂现有测试：tests/commands/setup.test.ts

功能: 为 OpenCode、DeepSeek Harness 生成接入文件

  场景: 拒绝未知平台
  场景: opencode 生成插件与 Skill，并写入 pm 命令路径
  场景: deepseek 生成 Skill，并以标记段落幂等更新 AGENTS.md
  场景: --global 写到用户主目录
