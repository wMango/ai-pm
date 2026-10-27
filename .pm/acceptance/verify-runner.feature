# language: zh-CN
# verify-runner（验收运行器）的接口契约；支撑 f-verify、f-autorun
# 补挂现有测试：tests/commands/verify.test.ts、tests/commands/hardening.test.ts

功能: 安全地运行验收文件并写出证据

  场景: 运行每个验收文件写出 evidence.json；--only 只重跑指定节点
  场景: 按最长后缀选 runner；没有 runner、文件缺失、超时都算不通过并警告
  场景: 文件路径经环境变量传入，任何模板写法都无法注入命令；以 - 开头或跳出项目的路径被拒绝
