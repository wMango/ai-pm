# ai-pm 的定位与发布

图形版：[publishing.html](publishing.html)

## 1. 它是什么

**品类：AI 编码代理插件（Agent Plugin）。** 附带一个本地命令行 `pm` 和一个离线的项目地图页面，三者打包在同一个插件里，装一次全部到位。

| 组成 | 形态 | 说明 |
|---|---|---|
| 代理插件 | Claude Code 插件格式（`.claude-plugin/` + `plugin/`） | 技能 `pm`、三个钩子、斜杠命令 `/pm-map`。Codex 直接兼容这个格式 |
| 命令行 `pm` | 单文件 Node 程序 `plugin/bin/pm.mjs` | 随插件安装；OpenCode、DeepSeek Harness 通过 `pm setup` 接入 |
| 项目地图 | 单个离线 HTML | 生成在用户自己仓库的 `.pm/` 里，打开即自动更新 |

**它不是**：云服务、MCP 服务器、VS Code 扩展、需要常驻的后台程序。所有数据都留在用户自己的仓库里。

### 对外怎么描述

- **一句话**：给 AI 编码代理用的项目管理插件——用架构图看进度，用验收测试判断完成，从目标倒推下一步。
- **一段话**：用 Claude Code、Codex 写代码时，项目会被 AI 迅速放大，任务列表和看板跟不上。ai-pm 装进你的代理之后，会把项目画成功能、逻辑、物理三张架构图，只按验收测试判断"做完"，区分"已建成"和"真正生效"，从目标倒推出杠杆最大的下一步，并按提交回看项目的演进。数据都在你的仓库里，不上传任何地方。
- **关键词**：project-management、dashboard、acceptance-tests、architecture-map、claude-code、codex、agent-plugin。

## 2. 发布到哪里

按推荐顺序：

| 渠道 | 用户怎么装 | 覆盖的平台 | 需要做什么 |
|---|---|---|---|
| **① GitHub 公开仓库（主渠道）** | `claude plugin marketplace add wMango/ai-pm` 后 `claude plugin install ai-pm@ai-pm`；Codex 同理 | Claude Code（终端、桌面应用、VS Code 扩展）、Codex | 仓库本身就是插件市场（根目录已有 `.claude-plugin/marketplace.json`），推送即发布，没有审核 |
| **② Anthropic 插件目录** | 在 [claude.ai/directory](https://claude.ai/directory) 里搜索安装 | Claude 的各个应用 | 在 [claude.ai/directory/manage](https://claude.ai/directory/manage) 提交；需要付费的 claude.ai 计划；见下方注意事项 |
| **③ GitHub Releases + 标签** | 固定版本：`claude plugin marketplace add wMango/ai-pm#v0.3.0` | 同 ① | 每次发布打标签、写更新说明 |
| **④ npm（可选，以后再做）** | `npx <包名> setup opencode` | OpenCode、DeepSeek Harness | 现在这两个平台要先 `git clone` 再构建；发布到 npm 后可以省掉这一步。需要在 `package.json` 里加 `bin` 和 `files`，并确认包名可用 |

**关于 ②（已核实与未核实）**

- 已核实：提交入口在开发者门户；提交前要用 `claude plugin validate ./plugin --strict` 校验；Anthropic 官方市场 `claude-plugins-official` 不接受门户提交。
- 已核实的风险：官方文档说明 claude.ai 和 Cowork **不会安装带顶层 `bin/` 目录的插件**。ai-pm 的命令行正好在 `plugin/bin/pm.mjs`。终端版和桌面应用的 Code 标签页不受影响；如果要上架目录，需要先把它挪到 `plugin/scripts/` 之类的位置，并同步改钩子、技能和 `pm setup` 里的路径。
- 未核实：审核标准、审核时长、是否要求仓库公开。提交前请以 [claude.com/docs/directory/publish](https://claude.com/docs/directory/publish) 为准。

## 3. 发布前清单

| # | 事项 | 现状 |
|---|---|---|
| 1 | 仓库改为公开 | ✅ 公开仓库 [wMango/ai-pm](https://github.com/wMango/ai-pm) |
| 2 | 选择开源许可证，加 `LICENSE`，并在 `plugin.json` 写 `license`（SPDX 标识，如 `MIT`） | ✅ MIT |
| 3 | 市场改正式名：`ai-pm-local` → 例如 `ai-pm`，安装命令随之变为 `ai-pm@ai-pm`；同步改 README 与 platforms 文档 | ✅ 已改为 `ai-pm` |
| 4 | `plugin.json` 补 `homepage`、`repository`、`author`、`keywords`（`homepage` 必须是合法 URL，否则插件加载失败） | ✅ 已补齐 |
| 5 | 版本策略：每次发布递增 `plugin.json` 的 `version`；**不要**在 marketplace 条目里再写一份 `version` | ✅ 当前 0.3.0；之后每次发布照做 |
| 6 | 运行 `claude plugin validate ./plugin --strict` | ✅ 已通过，并已加入 CI（`.github/workflows/ci.yml`，每次推送和 PR 都跑） |
| 7 | 把开发分支合并进 `main`，打标签（如 `v0.3.0`），在 GitHub Releases 写更新说明 | ✅ v0.3.0 |
| 8 | 换一台机器或一个新用户，从零按 README 安装、初始化、开工走一遍 | ⚠️ 已在空配置下从公开仓库安装，并跑通初始化、地图和状态栏；还差在真实会话里让 AI 走完开工流程 |
| 9 | 决定仓库自己的 `.pm/`（本项目的项目地图与 token 流水）是否随仓库公开 | ✅ 随仓库公开，本仓库就是用 ai-pm 管理自己的示例 |
| 10 | （仅当要上架 Anthropic 目录）把 `plugin/bin/` 挪出顶层 `bin/` | ⚠️ 视是否上架而定 |

## 4. 发布之后，用户怎么更新

- Claude Code：`claude plugin marketplace update <市场名>`，再 `claude plugin update ai-pm@<市场名>`；或在 `/plugin` 的 Installed 标签页选 Update now。新版本在新会话或 `/reload-plugins` 后生效。
- 第三方市场默认**不自动更新**。用户可以在 `/plugin` → Marketplaces 里打开 Enable auto-update。
- 只有版本号变了，用户才会拿到新版本：所以每次发布都要递增 `plugin.json` 的 `version`（或者干脆不写 `version`，让 git 市场用提交哈希当版本）。

## 资料来源

- 安装与更新：<https://code.claude.com/docs/en/plugins/install.md>
- 托管市场、私有仓库、固定版本：<https://code.claude.com/docs/en/plugins/host-marketplace.md>
- 发布与版本：<https://code.claude.com/docs/en/plugins/publish.md>
- 清单字段：<https://code.claude.com/docs/en/plugins/manifest-reference.md>、<https://code.claude.com/docs/en/plugins/marketplace-reference.md>
- 桌面应用：<https://code.claude.com/docs/en/desktop.md>
- Codex 兼容性的验证记录：[platforms.md](platforms.md)
