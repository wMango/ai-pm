# 在各代理平台上安装与使用 ai-pm

> 配套图形版：[platforms.html](platforms.html) · 总览见 [README](../README.md)

ai-pm 的核心是一个命令行工具 `pm`（打包后是 `plugin/bin/pm.mjs`，只需要 Node.js 20 以上）。各代理平台只是用不同的方式调用它：

- **技能**：告诉 AI 每个阶段该做什么；
- **钩子 / 插件**：在会话开始、每轮结束、会话结束时自动调用 `pm`。

本文核对的平台版本（2026-10-27）：

| 平台 | 版本 |
|---|---|
| Claude Code | 2.1.299 |
| Codex CLI | 0.132.0 |
| OpenCode | 1.17.12；官方最新稳定版是 1.19.4 |
| DeepSeek Harness | 0.2.1-rc.2 |

这些平台的扩展机制变化很快，以各自的官方文档为准。

## 1. 一张表看懂差异

| 能力 | Claude Code | Codex | OpenCode | DeepSeek Harness |
|---|---|---|---|---|
| 安装方式 | 插件市场 | 插件市场（直接兼容 Claude Code 插件） | `pm setup opencode` | `pm setup deepseek` |
| 技能 `pm` | ✅ | ✅ | ✅ | ✅ |
| 会话开始注入"下一步" | ✅ 钩子 | ✅ 钩子 | ✅ 插件（OpenCode 的实验性接口） | ⚠️ 由 AGENTS.md 指示 AI 运行 `pm context` |
| 每轮自动记录 token | ✅ | ✅ | ✅ | ❌ 暂不支持 |
| 会话结束自动验收 | ✅ 后台进程 | ✅ 后台进程 | ✅ 删除会话时触发 | ⚠️ 由 AGENTS.md 指示 AI 运行 `pm verify` |
| 功能层锁定由人在终端确认 | ✅ | ✅ | ✅ | ✅ |
| 验证程度 | 打包产物端到端演练 | 真实安装 + 按 Codex 约定模拟钩子 + 解析本机真实会话记录 | 技能已被 OpenCode 识别；插件逻辑用模拟事件测试 | 核对了配置与源码，未运行真实会话 |

**功能层锁定为什么在所有平台都成立**：四个平台的 AI 执行命令时都没有终端（Codex、OpenCode 的源码里都确认是管道方式）。所以 `pm lock` 遇到功能层节点时一定会拒绝 AI，必须由你在自己的终端里运行并按 `y`。

## 2. 共同的准备

二选一：

- **用插件市场**（Claude Code、Codex）：不需要下载源码。
- **用 `pm setup`**（OpenCode、DeepSeek Harness）：需要本仓库的源码，并构建出 `pm.mjs`：

```bash
git clone https://github.com/wMango/ai-pm.git ~/ai-pm
```

```bash
cd ~/ai-pm && npm install && npm run build:plugin
```

下文用 `PM` 代指 `node ~/ai-pm/plugin/bin/pm.mjs`。

在要管理的项目里初始化一次（也可以让 AI 在会话里替你做）：

```bash
node ~/ai-pm/plugin/bin/pm.mjs init --project "我的项目"
```

## 3. Claude Code

### 安装

```bash
claude plugin marketplace add wMango/ai-pm
```

```bash
claude plugin install ai-pm@ai-pm
```

### 使用

- 新开会话后直接说"帮我初始化项目地图"、"开始做上传文档功能"、"下一步做什么"，AI 会加载 `pm` 技能并按流程引导。
- 三个钩子自动工作：会话开始注入摘要，每轮结束记 token 并刷新页面，会话结束在后台跑验收。
- 项目地图：`.pm/dashboard.html`。

### 用 DeepSeek 模型跑 Claude Code

DeepSeek 提供 Anthropic 兼容接口。把 Claude Code 指向它，ai-pm 的插件照常工作：

```bash
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
```

```bash
export ANTHROPIC_AUTH_TOKEN=你的 DeepSeek API Key
```

可用的模型名请以 [DeepSeek 官方说明](https://api-docs.deepseek.com/guides/agent_integrations/claude_code) 为准。

## 4. Codex

Codex 能直接识别 Claude Code 格式的插件市场（`.claude-plugin/marketplace.json`）和插件清单。它还会给插件钩子设置 `CLAUDE_PLUGIN_ROOT` 环境变量，用来兼容现有插件。所以 ai-pm 的插件不用改就能装。我在临时目录里实际装过一遍：技能、钩子和 `pm.mjs` 都被正确安装。

### 安装

```bash
codex plugin marketplace add wMango/ai-pm
```

```bash
codex plugin add ai-pm@ai-pm
```

装完后新开一个 Codex 会话：

1. 在会话里输入 `/hooks`，审核并信任 ai-pm 的三个钩子。Codex 要求非托管钩子先经人审核才会运行。
2. 确认沙箱允许写项目目录（`workspace-write`）。AI 运行 `pm start`、`pm verify` 时要写 `.pm/`；只读沙箱会拦住这些写入。

### 使用

- 输入 `$pm` 或 `/skills` 调用技能；任务和技能描述匹配时，Codex 也会自动调用。
- 钩子与 Claude Code 同名同义：SessionStart 注入摘要，Stop 记 token、刷新页面，SessionEnd 在后台验收。
- **token 统计**：Codex 的会话记录（`~/.codex/sessions/…/rollout-*.jsonl`）里，`token_count` 事件给出的是会话累计值，ai-pm 取最后一条。Codex 的 `input_tokens` 已包含缓存命中部分，`output_tokens` 已包含推理 token，ai-pm 会自动换算。

> 已验证：用本机一份真实的 Codex 会话记录，按 Codex 的钩子约定（stdin JSON 加 `CLAUDE_PLUGIN_ROOT`）调用已安装插件的钩子，记下了 17.4 万 token（输入 16.3 万 + 输出 1.1 万；缓存读取 742.6 万按默认口径不计入）。重复触发不会重复计数。
> 未验证：Codex 在真实会话里自动触发这些钩子（需要调用模型）。

## 5. OpenCode

OpenCode 能读取 Claude Code 格式的技能，但**不能**加载 Claude Code 的插件和钩子，所以 ai-pm 为它单独生成一个 JS 插件。

### 安装

在项目目录里运行（只对这个项目生效）：

```bash
node ~/ai-pm/plugin/bin/pm.mjs setup opencode
```

或者对所有项目生效：

```bash
node ~/ai-pm/plugin/bin/pm.mjs setup opencode --global
```

会写入两个文件（加 `--global` 时写到 `~/.config/opencode/` 下）：

| 文件 | 作用 |
|---|---|
| `.opencode/skills/pm/SKILL.md` | 技能；已写入本机 `pm.mjs` 的绝对路径 |
| `.opencode/plugins/ai-pm.js` | 插件，OpenCode 启动时自动加载 |

### 插件做了什么

| OpenCode 事件 | ai-pm 动作 |
|---|---|
| 每次请求模型前（`experimental.chat.system.transform`） | 把项目摘要追加到系统提示；每轮空闲后重新计算 |
| `message.updated`（助手消息完成） | 把这条消息的 token 用量写成通用格式。推理 token 计入输出 |
| `session.idle`（一轮结束） | 调用 `pm hook stop`：记 token、刷新页面 |
| `session.deleted`（删除会话） | 调用 `pm hook session-end`：后台验收 |

OpenCode 没有"会话结束"事件，会话通常不会被显式结束。所以想看最新的验收结果时，手动运行一次：

```bash
node ~/ai-pm/plugin/bin/pm.mjs verify && node ~/ai-pm/plugin/bin/pm.mjs dashboard
```

### 使用

- 和 AI 说"用 pm 技能初始化项目地图"、"开始做 XX 功能"即可，OpenCode 会通过内置的 skill 工具加载技能。
- 把技能装进项目目录后，可以用 `opencode debug skill` 确认列表里有 `pm`。

> 已验证：在临时项目里运行 `pm setup opencode` 后，`opencode debug skill` 列出了 `pm` 技能。插件逻辑用模拟事件测试过：token 正确记到当前模块，摘要被追加到系统提示，没有 `.pm/` 的项目里保持静默。
> 未验证：OpenCode 在真实会话里加载并调用这个插件（需要调用模型）。系统提示注入用的是 OpenCode 标为实验性的接口，将来可能变化。另外，OpenCode 正在开发的 V2 插件接口和现在的不同，正式发布后可能需要调整。

## 6. DeepSeek Harness（`dsh`）

DeepSeek Harness 是 DeepSeek 官方开源的代理框架（[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，2026-08 发布，仍是预览版）。它的扩展都基于自己的 Cordis 插件体系。兼容 Claude Code 钩子的桥接包还是 alpha 版，所以 ai-pm 暂时只用它稳定支持的两样东西：**技能**和 **AGENTS.md**。

### 安装

在项目目录里运行（只对这个项目生效）：

```bash
node ~/ai-pm/plugin/bin/pm.mjs setup deepseek
```

或者对所有项目生效：

```bash
node ~/ai-pm/plugin/bin/pm.mjs setup deepseek --global
```

会写入：

| 文件 | 作用 |
|---|---|
| `.agents/skills/pm/SKILL.md`（全局：`~/.agents/skills/pm/`） | 技能；已写入本机 `pm.mjs` 的绝对路径 |
| `AGENTS.md`（全局：`~/.dsh/AGENTS.md`） | 追加一段 ai-pm 说明，写明何时运行 `pm context`、`pm start`、`pm verify`、`pm dashboard`。用 `<!-- ai-pm:start -->` 标记，重复运行只会更新这一段，不会动你原有的内容 |

**注意**：`~/.agents/skills/` 也是 Codex 的用户级技能目录。如果你已经通过插件在 Codex 里装了 ai-pm，再全局运行这条命令，Codex 里会出现两个 `pm` 技能。只在 DeepSeek Harness 用的项目里用项目级安装，就能避开。

### 使用

```bash
dsh web
```

或在终端里使用：

```bash
dsh headless "看看项目地图，下一步做什么"
```

- AI 会按 AGENTS.md 的说明，在会话开始时运行 `pm context`，在结束前运行 `pm verify` 和 `pm dashboard`。
- **token 不会自动记录**：DeepSeek Harness 的会话记录默认是压缩格式（`~/.dsh/sessions`），用量通过它自己的插件接口提供，ai-pm 还没有对接。成本视图里只会出现其他平台记下的 token。

> 已核对：DeepSeek Harness 的源码默认扫描 `.agents/skills`、`.dsh/skills` 和 `AGENTS.md`。在它自带的 web 配置里，技能和指令读取在顶层是关闭的，但在每个代理的配置里是开启的。
> 未验证：在真实的 `dsh` 会话里加载技能并按 AGENTS.md 执行（需要调用模型）。

## 7. 各平台通用的日常操作

不管用哪个平台，都可以直接运行这些命令：

| 想做的事 | 命令 |
|---|---|
| 看下一步 | `PM context` |
| 开工 | `PM start <节点 id>` |
| 锁定功能层验收条目（只能你在终端里做） | `PM lock <节点 id>`，然后按 `y` |
| 允许会话结束时自动跑测试 | `PM trust` |
| 立即验收并刷新地图 | `PM verify && PM dashboard` |

## 8. 自动化程度对比

| | Claude Code | Codex | OpenCode | DeepSeek Harness |
|---|---|---|---|---|
| 你需要手动做的 | 终端按 `y` | 终端按 `y`；首次审核钩子 | 终端按 `y`；偶尔手动验收 | 终端按 `y` |
| AI 按技能 / 指令做的 | 起草条目、写测试、开工 | 同左 | 同左 | 同左，外加开始和结束时运行 `pm` |
| 钩子 / 插件自动做的 | 注入、记 token、验收 | 注入、记 token、验收 | 注入、记 token、（删除会话时）验收 | 无 |

## 9. 故障排查

| 现象 | 原因与处理 |
|---|---|
| 会话里没有出现"项目地图"摘要 | 项目里还没有 `.pm/pm.yaml`（钩子在未初始化的项目里静默）；或者 Codex 的钩子还没在 `/hooks` 里信任 |
| `.pm/last-run.log` 写着"runners 配置未被信任" | 运行 `PM trust` 确认测试命令 |
| AI 说 `pm lock` 被拒绝 | 预期行为：功能层必须由你在终端里运行这条命令并按 `y` |
| 成本视图里 token 都记在 `unassigned` 下 | 会话开始时没有先运行 `pm start <id>` |
| Codex 里 AI 运行 `pm` 报写入失败 | 沙箱是只读的，改为 `workspace-write` |
| 改了 ai-pm 源码后没生效 | 重新 `npm run build:plugin`；Claude Code、Codex 还要重新安装插件，或运行 `/reload-plugins` |
