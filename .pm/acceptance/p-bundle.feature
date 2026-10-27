# language: zh-CN
# p-bundle（插件构建产物 plugin/bin/pm.mjs）健康检查

功能: 插件构建产物可运行且与源码一致

  场景: 产物存在并能运行
    当 用 node 运行 plugin/bin/pm.mjs context
    那么 退出码为 0，输出包含「项目地图」

  场景: 地图前端资源齐全且与源码一致
    那么 plugin/bin/client/ 与 src/dashboard/client/ 内容完全相同
