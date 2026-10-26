import { z } from "zod";

/** 三套架构视图 */
export const VIEW_NAMES = ["functional", "logical", "physical"] as const;
export type ViewName = (typeof VIEW_NAMES)[number];

/** 逻辑视图的分层，决定旅程蓝图里的泳道 */
export const LOGICAL_LAYERS = ["front", "service", "data", "external"] as const;
export type LogicalLayer = (typeof LOGICAL_LAYERS)[number];

/** 未声明当前模块时，token 记在这个保留 id 下 */
export const UNASSIGNED_NODE = "unassigned";

export const DEFAULT_SETTINGS = {
  maxNodesPerView: 40,
  stuckDays: 5,
  /** 单个验收测试的超时秒数 */
  testTimeoutSec: 300,
  /** processed：输入 + 输出 + 缓存写入；all：再加上缓存读取 */
  tokenCount: "processed",
  /** 按文件后缀选择运行命令，{file} 会替换成加了引号的路径 */
  runners: { ".sh": "bash {file}" } as Record<string, string>,
} as const;

/** 项目内的相对路径：不能是绝对路径，也不能用 .. 跳出项目 */
const CONTROL_IN_PATH = new RegExp("[\\u0000-\\u001f\\u007f]");
const projectPathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !/^[A-Za-z]:/.test(p) && !p.split(/[\\/]/).includes(".."), "必须是项目内的相对路径，不能包含 ..")
  .refine((p) => !p.startsWith("-"), "路径不能以 - 开头（会被当成命令行参数）")
  .refine((p) => !CONTROL_IN_PATH.test(p), "路径里不能有换行等控制字符");

const idSchema = z.string().regex(/^[A-Za-z0-9][\w.-]*$/, "id 只能包含字母、数字、-、_、.");

const dependencySchema = z.object({
  on: idSchema,
  kind: z.enum(["hard", "soft"]).default("hard"),
});

const baseNodeSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** 验收条目（Gherkin .feature），人或 AI 确认后锁定 */
  spec: projectPathSchema.optional(),
  /** 可执行的验收测试；状态只由这些测试的结果决定 */
  acceptance: z.array(projectPathSchema).default([]),
  /** 本视图内的依赖；跨视图关系只能通过 mappings 表达 */
  depends: z.array(dependencySchema).default([]),
});

const logicalNodeSchema = baseNodeSchema.extend({ layer: z.enum(LOGICAL_LAYERS) });

const mappingSchema = z.object({
  from: idSchema,
  to: z.union([idSchema, z.array(idSchema).min(1)]).transform((v) => (Array.isArray(v) ? v : [v])),
  /** realized_by：功能 → 逻辑；deployed_on：逻辑 → 物理 */
  kind: z.enum(["realized_by", "deployed_on"]),
  /** all：全部支撑节点生效才算；any：任一生效即可（冗余部署） */
  require: z.enum(["all", "any"]).default("all"),
});

const journeyStepSchema = z.object({
  step: z.string().min(1),
  functional: idSchema,
  /** later：故事地图切线以下，不在当前目标范围内 */
  slice: z.enum(["now", "later"]).default("now"),
});

const goalSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  requires: z.array(idSchema).min(1),
  journey: z.array(journeyStepSchema).default([]),
});

export const pmModelSchema = z.object({
  version: z.literal(1),
  project: z.string().min(1),
  settings: z
    .object({
      maxNodesPerView: z.number().int().positive().default(DEFAULT_SETTINGS.maxNodesPerView),
      stuckDays: z.number().positive().default(DEFAULT_SETTINGS.stuckDays),
      testTimeoutSec: z.number().int().positive().default(DEFAULT_SETTINGS.testTimeoutSec),
      tokenCount: z.enum(["processed", "all"]).default(DEFAULT_SETTINGS.tokenCount),
      runners: z
        .record(z.string().regex(/^\.[\w.-]+$/, "后缀要以 . 开头"), z.string().includes("{file}", { message: "命令里必须包含 {file}" }))
        .default({ ...DEFAULT_SETTINGS.runners }),
    })
    .default({ ...DEFAULT_SETTINGS, runners: { ...DEFAULT_SETTINGS.runners } }),
  views: z.object({
    functional: z.array(baseNodeSchema).default([]),
    logical: z.array(logicalNodeSchema).default([]),
    physical: z.array(baseNodeSchema).default([]),
  }),
  mappings: z.array(mappingSchema).default([]),
  goals: z.array(goalSchema).default([]),
});

export type PmModel = z.infer<typeof pmModelSchema>;
export type PmNode = z.infer<typeof baseNodeSchema> & { layer?: LogicalLayer };
export type Mapping = z.infer<typeof mappingSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type JourneyStep = z.infer<typeof journeyStepSchema>;

/** 某个节点的验收测试结果（由测试运行器产出，不写在 pm.yaml 里） */
export const nodeEvidenceSchema = z.object({
  passed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** 锁定后测试文件被改动，等待人复核 */
  pendingReview: z.boolean().default(false),
});
export const evidenceSchema = z.record(idSchema, nodeEvidenceSchema);
export type NodeEvidence = z.infer<typeof nodeEvidenceSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;

/** .pm/ledger.jsonl 的一行：一次会话在某个节点上的 token 消耗 */
export const tokenBreakdownSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  cacheWrite: z.number().int().nonnegative(),
  cacheRead: z.number().int().nonnegative(),
});
export type TokenBreakdown = z.infer<typeof tokenBreakdownSchema>;

export const ledgerEntrySchema = z.object({
  node: idSchema,
  at: z.iso.datetime({ offset: true }),
  tokens: z.number().int().nonnegative(),
  /** 来自哪次 Claude Code 会话；用于增量记录，避免重复计数 */
  session: z.string().min(1).optional(),
  breakdown: tokenBreakdownSchema.optional(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export type Status = "todo" | "doing" | "done";
/** 展示状态：未建 / 进行中 / 已建未生效 / 已生效 */
export type DisplayState = "todo" | "doing" | "blocked" | "ok";
