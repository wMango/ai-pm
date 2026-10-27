# language: zh-CN
# cli（pm 命令行）的接口契约；支撑 f-describe、f-verify、f-map、f-lock、f-setup
# 补挂现有测试：tests/cli.test.ts

功能: pm 命令行把输入转成清楚的输出和退出码

  场景: dashboard 命令读 pm.yaml、evidence、ledger 并写出页面，后两者可选
  场景: 支持自定义 .pm 目录和输出路径
  场景: pm.yaml 缺失、校验失败、evidence 损坏时以非零退出码给出中文原因
  场景: 有警告时仍然成功并打印警告
  场景: 打印前去掉终端控制字符
  场景: 未知命令或错误参数时打印用法
