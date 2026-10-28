// 测试绝不继承宿主 Claude 会话的变量（如 CLAUDE_PROJECT_DIR），否则临时项目会被导回真实项目。
// AI_PM_* 保留：被验收调起时，防递归的根目录与嵌套层数仍须生效。
for (const key of Object.keys(process.env)) {
  if (key.startsWith("CLAUDE_")) delete process.env[key];
}
