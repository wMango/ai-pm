import { upstream } from "./graph.js";
import { planFor, simulate } from "./evaluate.js";
import type { Evaluation } from "./evaluate.js";
import type { Goal } from "./schema.js";

export interface GoalReport {
  id: string;
  name: string;
  /** 目标依赖闭包中的节点数 */
  total: number;
  effectiveCount: number;
  /** 生效进度 0–1 */
  ratio: number;
  /** 还没完成、需要去建的节点 */
  toBuild: string[];
  /** 已完成但被卡住的节点 */
  blocked: string[];
}

export interface GoalDelta {
  goal: string;
  before: number;
  after: number;
}

export interface Recommendation {
  /** 想让其生效的目标节点 */
  target: string;
  /** 为此需要完成的全部节点 */
  plan: string[];
  /** 各目标进度提升的百分点之和 */
  gain: number;
  /** 每完成一个节点带来的提升 = gain / plan.length */
  leverage: number;
  goalDeltas: GoalDelta[];
  /** 完成后新变为生效的节点 */
  unblocked: string[];
}

export const goalClosure = (ev: Evaluation, goal: Goal): string[] => {
  const ids = new Set(goal.requires.flatMap((r) => upstream(ev.graph, r)));
  return ev.graph.order.filter((id) => ids.has(id));
};

const reportFor = (ev: Evaluation, goal: Goal): GoalReport => {
  const nodes = goalClosure(ev, goal);
  const effectiveCount = nodes.filter((id) => ev.effective.get(id)).length;
  return {
    id: goal.id,
    name: goal.name,
    total: nodes.length,
    effectiveCount,
    ratio: effectiveCount / nodes.length,
    toBuild: nodes.filter((id) => ev.statuses.get(id) !== "done").sort(),
    blocked: nodes.filter((id) => ev.statuses.get(id) === "done" && !ev.effective.get(id)).sort(),
  };
};

export const goalReports = (ev: Evaluation): GoalReport[] => ev.model.goals.map((g) => reportFor(ev, g));

/** 假设 doneIds 都已完成后的目标进度 */
export const whatIf = (ev: Evaluation, doneIds: readonly string[]): GoalReport[] => goalReports(simulate(ev, doneIds));

const recommendationFor = (ev: Evaluation, before: GoalReport[], target: string): Recommendation | null => {
  const plan = planFor(ev, target);
  const sim = simulate(ev, plan);
  const after = goalReports(sim);
  const goalDeltas = before
    .map((b, i) => ({ goal: b.id, before: b.ratio, after: after[i]?.ratio ?? b.ratio }))
    .filter((d) => d.after !== d.before);
  const gain = goalDeltas.reduce((acc, d) => acc + (d.after - d.before) * 100, 0);
  if (gain <= 0) return null;
  const unblocked = ev.graph.order.filter((id) => !ev.effective.get(id) && sim.effective.get(id)).sort();
  return { target, plan, gain, leverage: gain / plan.length, goalDeltas, unblocked };
};

/** 下一步推荐：对每个未完成节点，算出"做完它及其缺口"能让目标前进多少，按杠杆排序 */
export const recommend = (ev: Evaluation): Recommendation[] => {
  const before = goalReports(ev);
  return ev.graph.order
    .filter((id) => ev.statuses.get(id) !== "done")
    .map((id) => recommendationFor(ev, before, id))
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.leverage - a.leverage || b.gain - a.gain || a.target.localeCompare(b.target));
};
