# language: zh-CN
# loader（加载与校验）的接口契约：输入 pm.yaml 文本，输出合法模型或中文错误清单
# 支撑功能 f-describe「用 pm.yaml 描述三套架构并得到校验提示」

功能: 加载并校验 pm.yaml

  场景: 合法的 pm.yaml 得到补齐默认值的模型
    假如 一份只写了 version、project 和若干节点的 pm.yaml
    当 调用 loadPmYaml
    那么 结果是成功的
    并且 settings 补齐了默认值（每视图上限 40、卡住天数 5、runners 含 .sh）
    并且 映射的 to 统一成列表，require 默认为 all，旅程步骤 slice 默认为 now

  场景: YAML 语法错误不抛异常，而是返回中文提示
    假如 一份 YAML 语法错误的文本
    当 调用 loadPmYaml
    那么 结果是失败的，错误以「YAML 解析失败」开头

  场景: 字段错误指出出错的字段路径
    假如 一个逻辑节点缺少 layer
    当 调用 loadPmYaml
    那么 错误里包含字段路径 views.logical.0.layer

  场景: 结构性错误逐条给出中文原因
    假如 pm.yaml 同时存在：id 重复、依赖不存在的节点、依赖跨视图、映射方向错误、旅程步骤指向非功能节点
    当 调用 loadPmYaml
    那么 每一类问题都有一条对应的中文错误
    假如 依赖与映射合起来形成环
    那么 错误指出「存在循环」并列出环上的节点

  场景: 节点超过上限只警告不报错
    假如 某个视图的节点数超过 maxNodesPerView
    当 调用 loadPmYaml
    那么 结果仍是成功的，并带一条「超过上限」的警告
