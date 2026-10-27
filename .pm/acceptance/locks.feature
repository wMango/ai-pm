# language: zh-CN
# locks（锁定与待复核）的接口契约；支撑 f-lock
# 补挂现有测试：tests/commands/workflow.test.ts、tests/commands/hardening.test.ts

功能: 记录锁定指纹，实时判断待复核

  场景: 锁定记下 spec、每个验收文件的指纹和当时的 runner；文件缺失时拒绝
  场景: 功能层或 --by human 必须在终端确认，只认 y；没人在场时混合锁定全部不生效
  场景: spec、测试或 runner 改动后立即待复核；spec 与验收重复列出的文件不会导致永久待复核
  场景: 功能层锁定不是人在终端确认的，保持待复核
