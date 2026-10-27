# language: zh-CN
# history-gen（提交历史生成）的接口契约；支撑 f-history
# 测试：tests/history/timeline.test.ts、tests/history/command.test.ts

功能: 从 git 历史重算每个提交的项目状态并生成页面

  场景: 时间轴从新到旧，比较相邻的有效快照得出新增生效、失去生效、建成待生效、增删模块与目标变化
  场景: 状态完全相同的提交标记为无变化
  场景: 会话 token 按时间窗 (上一个提交, 本提交] 归属，缺少会话 id 的记录各算一次
  场景: 没有 pm.yaml 的提交标为尚未接入、不生成页面；工作区以 worktree 为键
  场景: 只读访问 git、不经过 shell；提交哈希先校验格式；路径按真实路径求相对路径
  场景: 每次生成前清掉旧页面，目录页与提交页共用同一个安全的单文件渲染器
