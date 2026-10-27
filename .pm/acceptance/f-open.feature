# language: zh-CN
# f-open：一步打开项目地图（功能层，待人确认）
# 测试：tests/live/open.test.ts

功能: 想看项目时，不用记文件在哪，一步就能打开地图

  场景: 在终端里一条命令打开
    当 我运行 pm open
    那么 先刷新地图，再用系统默认浏览器打开 .pm/dashboard.html
    并且 运行 pm open history 打开提交历史目录页（需要 git 仓库）
    并且 加 --print 只输出文件路径、不打开浏览器，方便在别的工具里使用

  场景: 在 Claude Code 里输入 / 就能找到
    当 我在对话框里输入 /pm-map
    那么 AI 打开项目地图：在桌面应用里优先在右侧面板打开，否则运行 pm open
    并且 输入 /pm-map history 打开提交历史

  场景: 在桌面应用的预览列表里点一下就开
    当 我在项目里运行 pm setup preview
    那么 项目的 .claude/launch.json 里多了一个 pm-map 预览入口，点开就在右侧面板显示实时地图
    并且 已有的其他预览配置保持不变；已经有 pm-map 或指向 pm serve 的入口时不重复添加
    并且 这个入口只在点开时启动服务，由应用负责停止
