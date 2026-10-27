# language: zh-CN
# git-tool（本机 git）的健康检查；支撑 history-gen
# 测试：ops/health/git-tool.sh

功能: 本机能用 git 读取项目历史

  场景: PATH 上有 git，能读出当前仓库的根目录与提交记录
