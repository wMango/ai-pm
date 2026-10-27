---
description: 打开 ai-pm 项目地图；加 history 打开提交历史
argument-hint: "[history]"
---

用户想看项目地图。参数：「$ARGUMENTS」（为空时打开地图；是 history 时打开提交历史）。

1. 先刷新并拿到页面路径：运行 `node "${CLAUDE_PLUGIN_ROOT}/bin/pm.mjs" open $ARGUMENTS --print`（会话开始注入的项目数据里如有「pm 命令」一行，用那里的命令代替 `node ".../pm.mjs"`）。
2. 打开它：
   - 在 Claude 桌面应用里，如果你能在右侧面板打开预览（例如有浏览器面板工具），优先在右侧面板打开这个文件；项目的预览列表里有 pm-map 时，也可以直接启动它，得到会实时更新的页面。
   - 否则运行 `pm open $ARGUMENTS`，用系统默认浏览器打开。
3. 用一两句话告诉用户打开了什么，并提醒：页面开着时会随项目自动更新；在桌面应用里想要一个随时可点的入口，可以运行 `pm setup preview`。

如果命令报错说找不到 pm.yaml，告诉用户这个项目还没用 ai-pm 管理，可以说"用 ai-pm 管理这个项目"来初始化。
