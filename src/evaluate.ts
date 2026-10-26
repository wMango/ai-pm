import { buildGraph, getNode } from "./graph.js";
import type { Graph, GraphNode, SupportGroup } from "./graph.js";
import type { DisplayState, Evidence, PmModel, Status } from "./schema.js";

/** 一次评估的结果：后续的目标、杠杆、成本、蓝图都基于它计算 */
export interface Evaluation {
  model: PmModel;
  graph: Graph;
  statuses: ReadonlyMap<string, Status>;
  effective: ReadonlyMap<string, boolean>;
  /** 自身已完成、却因跨视图支撑未生效而被卡住的节点 */
  crossViewBlocked: ReadonlySet<string>;
  pendingReview: ReadonlySet<string>;
}

/**
 * 状态只看验收：既没有验收条目也没有验收测试 → 未建；
 * 有条目或测试但测试没有全部通过（含只有条目、没跑过、用例数为 0）→ 进行中；全部通过 → 已完成
 */
const deriveStatus = (node: GraphNode, evidence: Evidence): Status => {
  if (!node.hasAcceptance) return node.hasSpec ? "doing" : "todo";
  const e = evidence[node.id];
  return e && e.total > 0 && e.passed === e.total ? "done" : "doing";
};

const groupSatisfied = (group: SupportGroup, isEffective: (id: string) => boolean): boolean =>
  group.require === "any" ? group.targets.some(isEffective) : group.targets.every(isEffective);

/** 生效(X) = 已完成(X) ∧ 本视图硬依赖都生效 ∧ 跨视图支撑组都满足 */
const computeEffective = (graph: Graph, statuses: ReadonlyMap<string, Status>): Map<string, boolean> => {
  const memo = new Map<string, boolean>();
  const isEffective = (id: string): boolean => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const node = getNode(graph, id);
    const result =
      statuses.get(id) === "done" &&
      node.hardDeps.every(isEffective) &&
      node.groups.every((g) => groupSatisfied(g, isEffective));
    memo.set(id, result);
    return result;
  };
  return new Map(graph.order.map((id) => [id, isEffective(id)]));
};

export const evaluateWithStatuses = (model: PmModel, graph: Graph, statuses: ReadonlyMap<string, Status>, pendingReview: ReadonlySet<string>): Evaluation => {
  const effective = computeEffective(graph, statuses);
  const isEffective = (id: string): boolean => effective.get(id) === true;
  const crossViewBlocked = new Set(
    graph.order.filter((id) => {
      const node = getNode(graph, id);
      return statuses.get(id) === "done" && !isEffective(id) && node.groups.some((g) => !groupSatisfied(g, isEffective));
    }),
  );
  return { model, graph, statuses, effective, crossViewBlocked, pendingReview };
};

export const evaluate = (model: PmModel, evidence: Evidence): Evaluation => {
  const graph = buildGraph(model);
  const statuses = new Map(graph.order.map((id) => [id, deriveStatus(getNode(graph, id), evidence)]));
  const pendingReview = new Set(graph.order.filter((id) => evidence[id]?.pendingReview === true));
  return evaluateWithStatuses(model, graph, statuses, pendingReview);
};

/** 假设某些节点已完成，重新评估（不修改原评估） */
export const simulate = (ev: Evaluation, doneIds: readonly string[]): Evaluation => {
  const statuses = new Map(ev.statuses);
  doneIds.forEach((id) => statuses.set(id, "done"));
  return evaluateWithStatuses(ev.model, ev.graph, statuses, ev.pendingReview);
};

export const displayState = (ev: Evaluation, id: string): DisplayState => {
  const status = ev.statuses.get(id) ?? "todo";
  if (status !== "done") return status;
  return ev.effective.get(id) ? "ok" : "blocked";
};

/**
 * 收集让 id 生效还缺的未完成节点（含自身）。
 * visited 保证每个节点只走一次，避免菱形依赖下的指数回溯；
 * 未满足的 any 组只需补上代价最小的那个目标。
 */
const collectMissing = (ev: Evaluation, id: string, visited: Set<string>, missing: Set<string>): void => {
  if (visited.has(id) || ev.effective.get(id)) return;
  visited.add(id);
  if (ev.statuses.get(id) !== "done") missing.add(id);
  const node = getNode(ev.graph, id);
  const isEffective = (x: string): boolean => ev.effective.get(x) === true;
  node.hardDeps.filter((d) => !isEffective(d)).forEach((d) => collectMissing(ev, d, visited, missing));
  node.groups
    .filter((g) => !groupSatisfied(g, isEffective))
    .flatMap((g) => {
      const candidates = g.targets.filter((t) => !isEffective(t));
      return g.require === "any" ? [cheapestTarget(ev, candidates)] : candidates;
    })
    .forEach((t) => collectMissing(ev, t, visited, missing));
};

/** 让 id 生效需要完成的全部节点（含自身，若自身未完成），按 id 排序 */
export const planFor = (ev: Evaluation, id: string): string[] => {
  const missing = new Set<string>();
  collectMissing(ev, id, new Set(), missing);
  return [...missing].sort();
};

const cheapestTarget = (ev: Evaluation, candidates: readonly string[]): string => {
  const ranked = candidates
    .map((t) => ({ t, size: planFor(ev, t).length }))
    .sort((a, b) => a.size - b.size || a.t.localeCompare(b.t));
  const best = ranked[0];
  if (!best) throw new Error("any 组没有可选目标");
  return best.t;
};

/** 根因阻塞：id 的上游链路上、真正还没完成的节点（不含自身），按 id 排序 */
export const rootBlockers = (ev: Evaluation, id: string): string[] => planFor(ev, id).filter((x) => x !== id);

