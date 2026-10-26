# P0 · pm.yaml 格式与计算引擎

> 配套图形版：[p0-engine.html](p0-engine.html) · 方法论见 [concept.md](concept.md)

## 1. 交付了什么

| 部分 | 位置 |
|---|---|
| `pm.yaml` schema（zod） | `src/schema.ts` |
| 加载与校验 | `src/load.ts` |
| 依赖图 | `src/graph.ts` |
| 状态与生效、根因阻塞、模拟 | `src/evaluate.ts` |
| 目标缺口、what-if、下一步推荐 | `src/goals.ts` |
| 成本 | `src/cost.ts` |
| 旅程蓝图推导 | `src/blueprint.ts` |
| 一次算出全部视图数据 | `src/analyze.ts` |
| 示例项目 | `tests/fixtures/kb-demo/` |
| 导出示例分析（供页面使用） | `scripts/export-demo.ts` → `docs/assets/p0-demo-data.js` |

命令：

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
npm run export-demo
```

## 2. 三个输入

| 输入 | 谁写 | 内容 |
|---|---|---|
| `pm.yaml` | 人 + AI | 目标、三套架构、依赖、映射、旅程 |
| 验收结果 `evidence` | 测试运行器（P2） | 每个节点 `{ passed, total, pendingReview }` |
| 成本流水 `ledger.jsonl` | 会话 hook（P2） | 每行 `{ node, at, tokens }` |

状态不写在 `pm.yaml` 里，只由验收结果推出（决策 2）。

## 3. `pm.yaml` 格式（version 1）

```yaml
version: 1
project: 智能知识库问答平台
settings:                 # 可省略
  maxNodesPerView: 40     # 超过只警告
  stuckDays: 5            # 进行中超过几天算卡住

views:
  functional:             # 功能视图
    - id: f-ask
      name: 基于文档问答
      acceptance: [features/ask.feature]   # 验收测试；为空 = 未建
      depends: [{ on: f-upload }]          # 只能依赖本视图节点；kind 默认 hard，可写 soft
  logical:                # 逻辑视图，多一个 layer: front | service | data | external
    - { id: chatui, name: 对话界面, layer: front, acceptance: [t/chatui.spec.ts], depends: [{ on: chatsvc }] }
  physical:               # 物理视图
    - { id: p-app-1, name: 应用服务器 1, acceptance: [ops/app1.sh] }

mappings:                 # 跨视图支撑，部分、可选
  - { from: f-ask, to: chatui, kind: realized_by }                         # 功能 → 逻辑
  - { from: chatsvc, to: [p-app-1, p-app-2], kind: deployed_on, require: any }  # 逻辑 → 物理

goals:
  - id: G1
    name: 用户能基于自有文档提问并得到答案
    requires: [f-login, f-ask]
    journey:              # 视图五；可省略
      - { step: 提问, functional: f-ask }
      - { step: 查看引用, functional: f-cite, slice: later }
```

### 校验规则

载入时全部检查，有错误则拒绝（返回中文错误列表，不抛异常）：

1. 字段类型与必填项（报出字段路径，比如 `views.logical.0.layer`）
2. 节点 id 在三个视图之间全局唯一；目标 id 唯一；同一节点的同类映射只能有一条（多个目标请合并为 `to` 列表 + `require`）
3. `depends` 只能指向本视图中存在的节点；跨视图关系必须用 `mappings`
4. `realized_by` 只能从功能指向逻辑，`deployed_on` 只能从逻辑指向物理
5. 映射、`requires` 引用的节点必须存在
6. 旅程步骤必须指向功能节点
7. 依赖（含软依赖）与映射合起来不能有环，有环时报出环路
8. 单个视图节点数超过上限 → 只警告

## 4. 计算规则

- **状态**：
  - 没有 `acceptance` → 未建；
  - 有 `acceptance`，但没跑过、没全部通过、或用例数为 0 → 进行中；
  - 全部通过 → 已完成。
- **生效**：`已完成 ∧ 本视图硬依赖都生效 ∧ 每条映射的支撑组都满足`。`require: all` 要求全部目标生效，`any` 只要求其一。阻塞只沿 物理 → 逻辑 → 功能 向上传播。
- **跨视图阻塞标记**：自身已完成，但有映射支撑组不满足。
- **根因阻塞**：沿"不满足的支撑"往上游走，收集真正没完成的节点，每个节点只走一次。
  - 已经被满足的 `any` 组不算阻塞，比如冗余副本挂了一台、另一台还健康。
  - 不满足的 `any` 组只取修复代价最小的那个目标：副本全挂时，修好一台就够。
- **目标进度**：目标 `requires` 的上游闭包中，已生效节点所占比例。同时列出"还要建"和"已建被卡住"两组节点。
- **下一步推荐**：
  - 对每个未完成节点，算出让它生效所需的完整计划（自身加上它的根因阻塞）。
  - 模拟计划全部完成后，把各目标进度的提升相加，作为收益（单位：百分点）。
  - 杠杆 = 收益 ÷ 计划大小，按杠杆排序；收益为 0 的不推荐。
- **成本**：
  - 按节点汇总 token。
  - 天数 = 首次会话到完成（最后一次会话）的时间；未完成的则算到现在。
  - 沉没 token = 花在未生效节点上的 token。
  - 卡住 = 进行中且天数超过 `stuckDays`。
- **蓝图**：
  - 一个旅程步骤占一列，内容 = 实现该功能的组件及其上游闭包，按泳道分组：前端层 → 前台；服务层 → 后台；数据层、外部依赖和物理节点 → 支撑。
  - 每列有三种结论：
    - 功能节点已生效 → 可走通；
    - 没有实现组件 → 映射缺口；
    - 否则 → 断开，根因取本列中最深的未完成节点（物理 > 数据/外部 > 服务 > 前端）；本列都没问题时，退回到功能节点自身或它的功能层依赖。

## 5. 示例项目的计算结果

23 个节点，已完成 12 个，已生效 9 个。

| 目标 | 生效进度 |
|---|---|
| G1 基于文档问答 | 9 / 19（47%） |
| G2 登录与账号 | 5 / 5（100%） |
| G3 按用量计费 | 2 / 5（40%） |

关键结论：

- 对话界面的根因阻塞是 PG 向量实例 → 向量数据库 → 向量检索。应用服务器 2 虽然挂了，但因为是 `any` 冗余，不算阻塞。
- 推荐第一位是"按用量计费"（3 个节点，G3 +60 个百分点）。G1 方向杠杆最高的是"向量检索"计划（3 个节点，G1 +31.6 个百分点，解锁 6 个节点）。
- 共消耗 131 万 token，其中 113 万是沉没成本；知识库管理台已进行 6 天，触发卡住预警。
- G1 旅程中，切线以内有 3 步，只有"登录"能走通。"上传文档"和"提问"都断在 PG 向量实例。"查看引用"是映射缺口。

## 6. 测试

- 53 个单元测试，覆盖校验、状态、生效与跨视图传播、目标、推荐、成本、蓝图、汇总，外加一个 60 节点菱形依赖的性能测试。
- 覆盖率：行 100%，语句 98.9%，分支 90.7%，函数 100%（门槛 80%）。
- 类型检查（`tsc --noEmit`，strict + noUncheckedIndexedAccess）通过。

## 7. 代码审查

独立审查结论：无 CRITICAL / HIGH，有 4 条 MEDIUM、4 条 LOW。已修复：

| 问题 | 修复 |
|---|---|
| `any` 组未满足时把所有目标都算进计划，推荐的杠杆被低估 | 只取代价最小的目标 |
| 根因计算在菱形依赖下指数回溯（30 层要 45 秒） | 加访问集合，每个节点只走一次（现在约 10 毫秒） |
| 成本分组 O(n²)，大量流水时 `Math.min(...)` 可能爆栈 | 单次遍历累加 |
| 目标 id 重复时成本会被静默覆盖 | 校验拒绝 |
| 同一节点同类映射写两条，会被当成 AND，容易误解 | 校验拒绝，要求合并 |
| 蓝图断点在功能节点自身未完成时为空 | 退回到功能节点或其功能层依赖 |

保留为设计选择，未改动：

- "卡住"按"开始到现在"计时，对应用户定义的"这个模块开始做到现在多长时间"。
- 软依赖也参与环检测；互相软依赖通常说明边界没划清，宁可在入口拒绝。

## 8. 留给后续阶段

- P1：用 `analyze()` 的输出替换概念页里的手写示例数据，生成 `.pm/dashboard.html`。
- P2：测试运行器产出 evidence、会话 hook 写 ledger、锁定指纹与"待复核"检测。P0 只消费 `pendingReview` 标记，不负责生成它。
