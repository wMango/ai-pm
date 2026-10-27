# language: zh-CN
# dash-render（地图渲染）的接口契约；支撑 f-map、f-cost
# 补挂现有测试：tests/dashboard-render.test.ts、tests/cost-blueprint.test.ts

功能: 把分析结果渲染成安全的单文件页面

  场景: 输出完整的 HTML 文档，内嵌分析数据，无需服务器
  场景: 不引用任何外部脚本、样式或字体
  场景: 标题和内嵌 JSON 里的用户内容被转义，包括 JavaScript 行分隔符
  场景: 带基于哈希的内容安全策略
  场景: analyze 输出包含全部视图、边、目标归属与设置，并对未知节点的证据给出警告
