# language: zh-CN
# p-repo（用户项目仓库里的 .pm/）健康检查

功能: 项目仓库承载 .pm 目录

  场景: 项目根目录有 .pm/pm.yaml
    当 在项目根目录运行健康检查
    那么 .pm/pm.yaml 存在且可读

  场景: pm.yaml 纳入版本管理
    假如 项目根目录是 git 工作区
    那么 .pm/pm.yaml 已被 git 跟踪

  场景: 本机私有文件不会被提交
    那么 .pm/.gitignore 排除了 current.json、last-run.log、trusted-runners
