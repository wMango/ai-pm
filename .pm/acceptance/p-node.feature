# language: zh-CN
# p-node（本机 Node.js 运行时）健康检查；插件产物以 node20 为目标构建

功能: 本机 Node.js 运行时可用

  场景: PATH 上有 node
    当 在项目根目录运行健康检查
    那么 能在 PATH 上找到 node 可执行文件

  场景: 版本满足插件要求
    当 读取 node 的主版本号
    那么 主版本号不低于 20
