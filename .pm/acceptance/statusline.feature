# language: zh-CN
# statusline（状态栏摘要）的接口契约；支撑 f-statusline
# 测试：tests/live/statusline.test.ts

功能: 从状态栏输入找到项目并输出一行摘要

  场景: 优先用输入里的 workspace.project_dir，其次 workspace.current_dir、cwd，再从当前目录向上找 .pm/
  场景: 输入不是合法 JSON 时按当前目录处理，不报错
  场景: 输出只有一行，不含控制字符，名字截短到固定长度
  场景: 找不到项目或 pm.yaml 无效时输出为空，退出码为 0
  场景: setup statusline 只在没有 statusLine 时写入，保留 settings.local.json 里的其他设置
