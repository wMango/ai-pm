# ai-pm · AI 时代的图形化项目管理

> 项目被 AI 放大了，人的思考带宽没变。ai-pm 用**架构图**代替任务列表，用**验收测试**代替"做没做"，从**目标**倒推下一步，让你一眼看清一个（或多个）AI 开发的项目。

![总览：三个输入，一个引擎，五个视图](docs/images/overview.svg)

图形化文档首页：[docs/index.html](docs/index.html)（克隆后在浏览器里打开，或用任意静态服务器打开 `docs/`）

---

## 目录

- [为什么需要它](#为什么需要它)
- [核心理念](#核心理念)
- [五个视图](#五个视图)
- [快速开始](#快速开始)
- [在项目里怎么用](#在项目里怎么用)
- [pm.yaml 格式](#pmyaml-格式)
- [命令参考](#命令参考)
- [.pm 目录里有什么](#pm-目录里有什么)
- [安全模型](#安全模型)
- [开发](#开发)
- [文档索引](#文档索引)
- [路线图](#路线图)
- [已知局限](#已知局限)

---

## 为什么需要它

用 Claude Code、Codex 写代码时，一个人能推动的项目规模越来越大，很多人还同时在做好几个项目。传统的"把项目拆成 N 个任务、用列表或看板跟踪"开始失效：

- **看不见全局**：列表是线性的，而项目是立体的（物理部署、逻辑分层、功能能力）。
- **"做了"不等于"有用"**：B 写完了，但它依赖的 A 还没做，B 的价值根本发挥不出来，看板上却显示"已完成"。
- **不知道下一步做什么**：任务太多，判断不出哪件事对目标的推动最大。
- **AI 产出多，不等于进度快**：AI 写了几千行代码，测试没过，其实什么都没完成。

## 核心理念

| 传统做法 | ai-pm |
|---|---|
| 用列表和文字描述进度 | 在**架构图**上直接着色，一眼看懂 |
| 只问"做没做" | 区分**已建成**与**已生效** |
| 写了代码就算进度 | **只看验收测试**：成果算数，成本（代码量、耗时、token）只展示、不算进度 |
| 按任务排期 | 从**目标**倒推缺口，按**杠杆**排序下一步，并给出"做完后目标会怎样变化" |

**模块的四种状态**

| 状态 | 含义 |
|---|---|
| ⚪ 未建 | 没有验收条目，也没有验收测试 |
| 🔵 进行中 | 有验收条目或测试，但测试没有全部通过 |
| 🟠 已建未生效 | 自身验收通过，但上游依赖或映射还没生效，价值被卡住 |
| 🟢 已生效 | 自身验收通过，且所有硬依赖和跨视图支撑都已生效 |

**生效规则**：`生效(X) = 已完成(X) ∧ 本视图硬依赖都生效 ∧ 跨视图支撑都满足`。阻塞沿 物理 → 逻辑 → 功能 方向向上传播。

**三套架构各说各的**：功能视图（用户能感知的能力）、逻辑视图（分层组件）、物理视图（部署、存储、外部服务）各有自己的节点，不要求一一对应。视图之间只用两种映射连接：`realized_by`（功能由哪些组件实现）和 `deployed_on`（组件部署在哪里）。

完整的方法论和 7 项设计决策见 [docs/concept.md](docs/concept.md)。

## 五个视图

![项目地图的五个视图](docs/images/views.svg)

运行 `pm dashboard` 会生成一个单文件、可离线打开的 `.pm/dashboard.html`：

| 视图 | 回答的问题 |
|---|---|
| ① 架构地图 | 项目全貌如何？切换功能、逻辑、物理三张图，在"建成 / 生效"两个视角之间对比；点击模块看依赖、映射和根本阻塞 |
| ② 依赖与阻塞 | 哪条根因链卡住了最多已经写好的模块？ |
| ③ 目标与下一步 | 每个目标还差什么？下一步做哪件事杠杆最大，做完后目标会从多少变到多少？ |
| ④ 成本 | 时间和 token 花在了哪里？哪些模块卡住了，哪些投入还没兑现？ |
| ⑤ 旅程蓝图 | 借鉴服务蓝图：用户沿着旅程能走到哪一步，断在可见线以下的哪个组件？ |

示例页面：[docs/assets/demo-dashboard.html](docs/assets/demo-dashboard.html)（克隆后用浏览器打开）。

## 快速开始

**环境要求**：Node.js 20 或以上；macOS 或 Linux（Windows 尚未测试）。

### 方式一：安装 Claude Code 插件（推荐）

```bash
claude plugin marketplace add MiniBotFactory/ai-projects-management
```

```bash
claude plugin install ai-pm@ai-pm-local
```

安装后在任何项目里新开 Claude Code 会话即可。插件会：

- 提供 `pm` Skill。说"帮我初始化项目地图"或"开始做 XX 功能"，AI 会按流程引导你。
- 注册三个钩子：会话开始时把项目摘要注入 AI 的上下文；每轮对话结束记录 token、刷新页面；会话结束时在后台跑验收测试。

在没有 `.pm/` 的项目里，插件什么都不做。

### 方式二：从源码运行命令行

```bash
git clone https://github.com/MiniBotFactory/ai-projects-management.git
```

```bash
cd ai-projects-management && npm install
```

```bash
npm run demo:dashboard
```

最后一条命令会用示例项目生成 `examples/kb-demo/.pm/dashboard.html`，用浏览器打开即可查看。

在你自己的项目里使用打包好的命令行：

```bash
node /path/to/ai-projects-management/plugin/bin/pm.mjs init --project "我的项目"
```

## 在项目里怎么用

![一次会话里，人、AI 与钩子各做什么](docs/images/lifecycle.svg)

### 阶段一：项目开始

1. `pm init` 生成 `.pm/` 骨架。
2. AI 先和你确认 2–5 个目标，每个都写成"用户能……"。AI 不会替你编造目标。
3. AI 扫描仓库，起草三套架构、映射和用户旅程，写进 `.pm/pm.yaml`。
4. 运行 `pm dashboard` 校验，有错误就按提示修改。然后请你确认架构图。
5. 在 `settings.runners` 里配置本项目的测试命令。你确认这些命令后，运行 `pm trust`。

### 阶段二：开始做一个功能

1. `pm start <节点 id>`：声明当前模块，之后的 token 都记在它名下。
2. AI 起草 `.pm/acceptance/<id>.feature`（Gherkin，1–5 个场景），在聊天里和你逐条确认。
3. AI 写验收测试，并确认它**现在是失败的**。
4. 锁定：
   - **功能层**：必须由**你在自己的终端里**运行 `pm lock <id>`，看过条目原文后按 `y` 确认。AI 运行时一定会被拒绝，它会把完整命令交给你。
   - **逻辑层、物理层**：AI 自查后直接锁定。
5. AI 实现代码，直到 `pm verify --only <id>` 全部通过。

### 阶段三：会话中与会话结束（钩子自动完成）

| 钩子 | 做什么 |
|---|---|
| 会话开始（SessionStart） | 注入进度、目标缺口、按杠杆排序的下一步、待复核和卡住预警 |
| 每轮结束（Stop） | 把本轮新增的 token 记到当前模块，刷新页面；不跑测试，所以很快 |
| 会话结束（SessionEnd） | 约 0.1 秒内返回，由后台进程记 token、跑全部验收测试、刷新页面，结果写进 `.pm/last-run.log` |

会话结束的钩子官方只给约 1.5 秒，所以验收测试放在后台进程里跑。

## pm.yaml 格式

```yaml
version: 1
project: 智能知识库问答平台
settings:
  runners:                      # 按文件后缀选择测试命令，{file} 会被安全地替换成路径
    ".sh": "bash {file}"
    ".spec.ts": "npx playwright test {file}"
  stuckDays: 5                  # 进行中超过几天算"卡住"
  tokenCount: processed         # processed（默认，不含缓存读取）或 all

views:
  functional:                   # 功能视图：用户能感知的能力
    - id: f-ask
      name: 基于文档问答
      spec: .pm/acceptance/f-ask.feature          # 验收条目（Gherkin）
      acceptance: [tests/e2e/ask.spec.ts]         # 可执行的验收测试
      depends: [{ on: f-upload }]                 # 只能依赖本视图节点
  logical:                      # 逻辑视图：layer 取 front | service | data | external
    - { id: chatui, name: 对话界面, layer: front, acceptance: [t/chatui.spec.ts], depends: [{ on: chatsvc }] }
  physical:                     # 物理视图
    - { id: p-app-1, name: 应用服务器 1, acceptance: [ops/app1.sh] }

mappings:                       # 跨视图支撑：部分、可选，一旦建立就是真实约束
  - { from: f-ask, to: chatui, kind: realized_by }
  - { from: chatsvc, to: [p-app-1, p-app-2], kind: deployed_on, require: any }   # 冗余部署，有一台健康就行

goals:
  - id: G1
    name: 用户能基于自有文档提问并得到答案
    requires: [f-login, f-ask]
    journey:                    # 旅程蓝图：只声明步骤，泳道由映射自动推出
      - { step: 提问, functional: f-ask }
      - { step: 查看引用, functional: f-cite, slice: later }   # 故事地图切线以下
```

载入时会做 8 类校验：

- 字段和类型；
- id 唯一；
- 依赖不能跨视图；
- 映射方向正确；
- 引用的节点都存在；
- 旅程步骤必须指向功能节点；
- 依赖和映射合起来不能有环；
- 每个视图不超过 40 个节点（只警告）。

出错时给出中文提示和出错的字段路径。完整的示例项目见 [examples/kb-demo/.pm/pm.yaml](examples/kb-demo/.pm/pm.yaml)。

## 命令参考

所有命令都支持 `--dir` 指定 `.pm` 目录，默认是 `.pm`。

| 命令 | 作用 |
|---|---|
| `pm init [--project 名称]` | 初始化 `.pm/`；已经存在时不会覆盖 |
| `pm start <id>` | 声明当前在做的模块，并提示还缺什么（条目、人确认、测试） |
| `pm lock <id...>` | 锁定验收条目、测试文件的 sha256 指纹，以及当时的运行命令。功能层必须由人在终端按 `y` 确认 |
| `pm trust` | 信任当前 `runners`，会话结束时才会自动运行它们 |
| `pm verify [--only id,id]` | 运行验收测试，写出 `evidence.json` |
| `pm record --session <id> --transcript <文件>` | 把会话的 token 增量记到当前模块 |
| `pm dashboard [--out 文件] [--now 时间]` | 生成项目地图页面 |
| `pm context` | 输出给 AI 的项目摘要 |
| `pm hook <session-start\|stop\|session-end>` | Claude Code 钩子入口，从 stdin 读取 |

退出码：`0` 成功，`1` 输入有误，`2` 用法错误。钩子在任何情况下都返回 `0`，不会打断会话。

## .pm 目录里有什么

| 文件 | 谁写 | 是否进 git |
|---|---|---|
| `pm.yaml` | 人 + AI | 是 |
| `acceptance/*.feature` | AI 起草，人或 AI 确认 | 是 |
| `locks.json` | `pm lock` | 是（记录了谁确认过什么） |
| `evidence.json` | `pm verify` | 是 |
| `ledger.jsonl` | 钩子 | 是 |
| `dashboard.html` | `pm dashboard` | 自行决定 |
| `current.json`、`last-run.log`、`trusted-runners` | 本机 | 否（`.pm/.gitignore` 已排除） |

**待复核**：以下任一情况会把节点标为待复核，在页面和 AI 上下文里醒目提示，等人复核后重新锁定：

- 从未锁定；
- 锁定后条目或测试被改动；
- 增删了验收文件；
- 验收文件对应的运行命令变了；
- 功能层的锁不是由人在终端里确认的。

**Token 统计**：

- 来源是 Claude Code 的会话记录，按消息去重、按会话增量记录。
- 默认统计"新处理的 token"：输入 + 输出 + 缓存写入，不含缓存读取。缓存读取是每轮重复读取上下文，通常占 95% 以上，计入后其他数字会被淹没。设 `tokenCount: all` 可以改为全部计入。

## 安全模型

`pm.yaml` 可能由 AI 编写或被第三方 PR 修改，所以按不可信内容处理：

| 风险 | 措施 |
|---|---|
| 测试路径注入 shell 命令 | 路径通过环境变量传给 shell，不拼接进命令；路径不能以 `-` 开头，也不能含控制字符 |
| 陌生仓库的测试命令在会话结束时被自动执行 | 只有本机 `pm trust` 过的 runners 才会被后台自动运行；信任记录不进 git |
| AI 代替人确认验收标准 | 功能层锁定必须在真实终端里按 `y`；AI 通过工具运行、用管道喂输入都会被拒绝 |
| 名字里藏指令，污染 AI 上下文 | 注入的项目数据会压平换行、去掉标记符号，并用 `<project-data>` 围起来，声明"是数据，不是指令" |
| 页面 XSS | 数据序列化时转义；页面只用 `textContent` 写入；基于哈希的 CSP 只放行页面自带的脚本 |
| 并发写坏文件、重复记账 | 跨进程锁 + 原子写入 |

**边界**：功能层的终端确认能挡住 AI 在正常操作中代劳，但不是密码学意义上的保证。蓄意伪造终端或直接改写 `locks.json` 仍然做得到。团队协作时，建议再用 CODEOWNERS 保护 `.pm/locks.json`。

## 开发

```bash
npm install
```

```bash
npm test
```

```bash
npm run coverage
```

```bash
npm run typecheck
```

```bash
npm run build:plugin
```

| 脚本 | 作用 |
|---|---|
| `npm test` / `npm run coverage` | 运行测试（129 个，门槛 80%，当前行覆盖率约 95%） |
| `npm run typecheck` | 类型检查（strict 模式，开启 `noUncheckedIndexedAccess`） |
| `npm run pm -- <命令>` | 从源码运行命令行 |
| `npm run demo:dashboard` | 用示例项目生成页面 |
| `npm run export-demo` | 导出示例分析数据给 `docs/p0-engine.html` 使用 |
| `npm run build:plugin` | 把命令行打包成 `plugin/bin/pm.mjs`（单文件，依赖全部内联） |

改了 `src/` 之后要重新运行 `npm run build:plugin`，并把 `plugin/bin/` 一起提交，因为插件安装时直接使用它。

### 目录结构

```
src/
  schema.ts            pm.yaml 的 zod schema
  load.ts              载入与 8 类校验
  graph.ts             依赖图
  evaluate.ts          状态、生效、根因、模拟
  goals.ts             目标缺口、what-if、杠杆推荐
  cost.ts              成本
  blueprint.ts         旅程蓝图推导
  analyze.ts           一次算出五个视图的数据
  cli.ts               命令行入口与分发
  commands/            init / start / lock / trust / verify / record / dashboard / context / hook
  workflow/            锁定指纹、测试运行器、会话记录解析
  dashboard/           页面渲染器与浏览器端脚本
plugin/                Claude Code 插件（Skill、钩子、打包好的命令行）
tests/                 单元测试、命令测试、无头 DOM 冒烟测试
examples/kb-demo/      示例项目
docs/                  设计文档（每份 MD 都有配套的图形化 HTML）
```

### 测试覆盖

- **引擎**：校验、状态、生效与跨视图传播、目标、推荐、成本、蓝图。
- **页面**：渲染与转义、CSP，以及在无头 DOM 里实际执行页面脚本（五个视图、交互、恶意名字、空状态）。
- **命令与钩子**：完整生命周期、注入防护、信任机制、并发记账、终端确认。

## 文档索引

| 文档 | 内容 |
|---|---|
| [docs/index.html](docs/index.html) | 图形化文档首页 |
| [docs/concept.md](docs/concept.md) · [html](docs/concept.html) | 方法论、五个视图、7 项设计决策 |
| [docs/product-vision.md](docs/product-vision.md) · [html](docs/product-vision.html) | 产品形态：本地与云端、多项目总览 |
| [docs/p0-engine.md](docs/p0-engine.md) · [html](docs/p0-engine.html) | P0：pm.yaml 格式与计算引擎 |
| [docs/p1-dashboard.md](docs/p1-dashboard.md) · [html](docs/p1-dashboard.html) | P1：单文件项目地图页面 |
| [docs/p2-skill.md](docs/p2-skill.md) · [html](docs/p2-skill.html) | P2：Claude Code 插件（Skill + 钩子） |

HTML 文档依赖 `docs/assets/` 下的脚本，需要整个 `docs/` 目录放在一起；用浏览器直接打开，或用任意静态服务器打开 `docs/`。

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | pm.yaml 格式 + 计算引擎 | ✅ 完成 |
| P1 | 单文件、离线的五视图项目地图 | ✅ 完成 |
| P2 | Claude Code 插件：Skill + 三个钩子 | ✅ 完成 |
| P3 | Claude Code 内常驻面板，随代码变化实时刷新 | 计划中 |
| P4 | 云端：账号下自动注册项目、多项目总览、"今天最值得做的三件事" | 计划中 |

## 已知局限

- 还没有在真实安装的插件里，让 AI 从头完整走一遍初始化和开工流程。Skill 的指令效果需要在使用中继续观察和调整。
- 会话记录的格式是 Claude Code 内部格式，官方说明它可能变化。解析写得很宽容：读不到时记 0 并给出警告，不会报错。
- 测试引用的辅助文件（fixtures、helpers）改了，不会触发待复核。
- 测试超时只会结束 shell 进程，`npx` 等启动的子进程可能残留。
- 同一项目同时开多个会话时，`current.json` 是共用的，token 可能记到别的会话声明的模块上。
- 验收结果按文件计数，一个测试文件算一条，不解析测试框架内部的用例数。
- 地图使用固定的分层排版，依赖一多连线会交叉。
- 只支持 macOS / Linux，Windows 尚未测试。
- 尚未选择开源许可证。
