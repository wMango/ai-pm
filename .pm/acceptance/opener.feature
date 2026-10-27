# language: zh-CN
# opener（打开入口）的接口契约；支撑 f-open
# 测试：tests/live/open.test.ts

功能: 统一的打开逻辑与三种入口

  场景: pm open 打开前先重新生成页面；history 目标在非 git 仓库时报错并说明原因
  场景: 打开动作由入口注入：命令行用系统打开方式（macOS open、Windows start、其他 xdg-open），不经过 shell
  场景: 没有可用的打开方式时（例如测试或无图形环境）只输出路径，退出码为 0
  场景: setup preview 合并写入 .claude/launch.json，按名称与命令去重，JSON 无效时不改动并报错
  场景: 插件提供 commands/pm-map.md，frontmatter 有 description，正文说明桌面应用优先用右侧面板、否则运行 pm open
