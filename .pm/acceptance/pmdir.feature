# language: zh-CN
# pmdir（.pm 目录：pm.yaml / evidence.json / ledger.jsonl）的读写契约
# 支撑 loader：loader 只解析文本，读文件与容错由这里负责

功能: 读写 .pm 目录

  场景: 没有 pm.yaml 时给出可操作的提示
    假如 .pm 目录里没有 pm.yaml
    当 加载模型
    那么 报错提示「先运行 pm init」

  场景: pm.yaml 无效时逐条列出原因
    假如 pm.yaml 内容不合法
    当 加载模型
    那么 报错以「pm.yaml 无效」开头，并列出每一条校验错误

  场景: evidence.json 缺失视为空，损坏时报错
    假如 没有 evidence.json
    那么 验收结果为空
    假如 evidence.json 不是合法 JSON
    那么 报错「evidence.json 不是合法 JSON」

  场景: ledger.jsonl 的坏行被跳过并给出警告
    假如 ledger.jsonl 有一行合法记录和一行坏数据
    当 读取账本
    那么 得到 1 条记录和 1 条指出行号的警告

  场景: 写入是原子的
    当 写入一个 JSON 文件
    那么 文件内容是格式化的 JSON，且目录里不留临时文件
