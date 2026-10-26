import { getNode, upstream } from "./graph.js";
import type { GraphNode } from "./graph.js";
import { planFor } from "./evaluate.js";
import type { Evaluation } from "./evaluate.js";
import type { Goal, JourneyStep } from "./schema.js";

/** 服务蓝图的三条系统泳道（用户行为泳道就是旅程步骤本身） */
export type Lane = "front" | "back" | "support";

export interface BlueprintStep {
  step: string;
  functional: string;
  slice: JourneyStep["slice"];
  /** ok：可以走通；broken：有阻塞；gap：没有任何实现组件（映射缺口） */
  status: "ok" | "broken" | "gap";
  lanes: Record<Lane, string[]>;
  /** 本列里最深（离用户最远）的未完成节点；没有则为 null */
  root: string | null;
}

export interface Blueprint {
  goal: string;
  steps: BlueprintStep[];
  summary: { inScope: number; usable: number };
}

/** 深度：物理 > 数据/外部 > 服务 > 前端，用来找"从最底下断掉"的根因 */
const depthOf = (node: GraphNode): number => {
  if (node.view === "physical") return 4;
  if (node.layer === "data" || node.layer === "external") return 3;
  if (node.layer === "service") return 2;
  return node.view === "logical" ? 1 : 0;
};

const laneOf = (node: GraphNode): Lane | null => {
  if (node.view === "physical") return "support";
  if (node.view !== "logical") return null;
  if (node.layer === "front") return "front";
  return node.layer === "service" ? "back" : "support";
};

/** 一个旅程步骤的列：实现该功能的组件及其上游闭包，按泳道分组；逻辑节点排在物理节点之前 */
const columnOf = (ev: Evaluation, functional: string): string[] => {
  const targets = getNode(ev.graph, functional).groups.filter((g) => g.kind === "realized_by").flatMap((g) => g.targets);
  const ids = new Set(targets.flatMap((t) => upstream(ev.graph, t)));
  return ev.graph.order.filter((id) => ids.has(id));
};

const stepFor = (ev: Evaluation, step: JourneyStep): BlueprintStep => {
  const column = columnOf(ev, step.functional);
  const lanes: Record<Lane, string[]> = {
    front: column.filter((id) => laneOf(getNode(ev.graph, id)) === "front"),
    back: column.filter((id) => laneOf(getNode(ev.graph, id)) === "back"),
    support: column.filter((id) => laneOf(getNode(ev.graph, id)) === "support"),
  };
  const base = { step: step.step, functional: step.functional, slice: step.slice, lanes };
  if (column.length === 0) return { ...base, status: "gap", root: null };
  if (ev.effective.get(step.functional)) return { ...base, status: "ok", root: null };
  // 优先指向本列里最深的阻塞；本列都没问题时（功能自身或其功能层依赖未完成），退回整个计划
  const plan = planFor(ev, step.functional);
  const inColumn = plan.filter((id) => column.includes(id));
  const candidates = inColumn.length ? inColumn : plan;
  const root = [...candidates].sort((a, b) => depthOf(getNode(ev.graph, b)) - depthOf(getNode(ev.graph, a)) || a.localeCompare(b))[0];
  return { ...base, status: "broken", root: root ?? null };
};

export const blueprint = (ev: Evaluation, goal: Goal): Blueprint => {
  const steps = goal.journey.map((s) => stepFor(ev, s));
  const inScope = steps.filter((s) => s.slice === "now");
  return { goal: goal.id, steps, summary: { inScope: inScope.length, usable: inScope.filter((s) => s.status === "ok").length } };
};
