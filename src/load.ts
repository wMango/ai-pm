import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { evidenceSchema, ledgerEntrySchema, pmModelSchema, UNASSIGNED_NODE, VIEW_NAMES } from "./schema.js";
import type { Evidence, LedgerEntry, PmModel, ViewName } from "./schema.js";
import { allNodes, findCycle } from "./graph.js";

export type LoadResult =
  | { ok: true; model: PmModel; warnings: string[] }
  | { ok: false; errors: string[] };

const formatIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join(".") || "(根)"}：${issue.message}`);

const MAPPING_DIRECTIONS = {
  realized_by: { from: "functional", to: "logical" },
  deployed_on: { from: "logical", to: "physical" },
} as const satisfies Record<string, { from: ViewName; to: ViewName }>;

const checkReferences = (model: PmModel): string[] => {
  const errors: string[] = [];
  const viewOf = new Map<string, ViewName>();
  for (const { node, view } of allNodes(model)) {
    if (viewOf.has(node.id)) errors.push(`id 重复：${node.id}`);
    if (node.id === UNASSIGNED_NODE) errors.push(`${UNASSIGNED_NODE} 是保留 id，用于记录未归属模块的 token`);
    viewOf.set(node.id, view);
  }
  for (const { node, view } of allNodes(model)) {
    for (const dep of node.depends) {
      const depView = viewOf.get(dep.on);
      if (!depView) errors.push(`${node.id} 依赖了不存在的节点 ${dep.on}`);
      else if (depView !== view) errors.push(`${node.id} → ${dep.on} 跨了视图（${view} → ${depView}），跨视图关系请用 mappings`);
    }
  }
  for (const mapping of model.mappings) {
    const rule = MAPPING_DIRECTIONS[mapping.kind];
    const ids = [mapping.from, ...mapping.to];
    const missing = ids.filter((id) => !viewOf.has(id));
    if (missing.length) {
      errors.push(`映射引用了不存在的节点 ${missing.join("、")}`);
      continue;
    }
    const wrongDirection = viewOf.get(mapping.from) !== rule.from || mapping.to.some((id) => viewOf.get(id) !== rule.to);
    if (wrongDirection) errors.push(`${mapping.from} 的映射方向错误：${mapping.kind} 必须从 ${rule.from} 指向 ${rule.to}`);
  }
  const mappingKeys = model.mappings.map((m) => `${m.from}|${m.kind}`);
  mappingKeys
    .filter((key, i) => mappingKeys.indexOf(key) !== i)
    .forEach((key) => {
      const [from, kind] = key.split("|");
      errors.push(`${from} 有多条 ${kind} 映射，请合并为一条（用 to 列表 + require 表达）`);
    });
  const goalIds = model.goals.map((g) => g.id);
  goalIds.filter((id, i) => goalIds.indexOf(id) !== i).forEach((id) => errors.push(`目标 id 重复：${id}`));
  for (const goal of model.goals) {
    for (const id of goal.requires) {
      if (!viewOf.has(id)) errors.push(`${goal.id} requires 引用了不存在的节点 ${id}`);
    }
    for (const step of goal.journey) {
      if (viewOf.get(step.functional) !== "functional") errors.push(`${goal.id} 的旅程步骤「${step.step}」必须指向功能节点，当前是 ${step.functional}`);
    }
  }
  return errors;
};

const checkLimits = (model: PmModel): string[] =>
  VIEW_NAMES.filter((v) => model.views[v].length > model.settings.maxNodesPerView).map(
    (v) => `${v} 视图有 ${model.views[v].length} 个节点，超过上限 ${model.settings.maxNodesPerView}，建议分层折叠`,
  );

/** 校验任意来源的对象是否为合法的 pm 模型（schema + 引用 + 方向 + 无环） */
export const validateModel = (raw: unknown): LoadResult => {
  const parsed = pmModelSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };
  const model = parsed.data;
  const errors = checkReferences(model);
  if (errors.length) return { ok: false, errors };
  const cycle = findCycle(model);
  if (cycle) return { ok: false, errors: [`依赖与映射中存在循环：${cycle.join(" → ")}`] };
  return { ok: true, model, warnings: checkLimits(model) };
};

export const loadPmYaml = (text: string): LoadResult => {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`YAML 解析失败：${message}`] };
  }
  return validateModel(raw);
};

/** 解析测试运行器产出的验收结果；不合法直接抛错 */
export const parseEvidence = (raw: unknown): Evidence => {
  const parsed = evidenceSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`验收结果格式错误：${formatIssues(parsed.error).join("；")}`);
  for (const [id, e] of Object.entries(parsed.data)) {
    if (e.passed > e.total) throw new Error(`验收结果错误：${id} 的通过数 ${e.passed} 大于总数 ${e.total}`);
  }
  return parsed.data;
};

/** 解析 .pm/ledger.jsonl；空行跳过，坏行报出行号 */
export const parseLedger = (text: string): LedgerEntry[] =>
  text.split("\n").flatMap((line, i) => {
    if (!line.trim()) return [];
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new Error(`ledger 第 ${i + 1} 行不是合法 JSON`);
    }
    const parsed = ledgerEntrySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`ledger 第 ${i + 1} 行格式错误：${formatIssues(parsed.error).join("；")}`);
    return [parsed.data];
  });
