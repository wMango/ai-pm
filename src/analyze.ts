import { getNode } from "./graph.js";
import { displayState, evaluate, rootBlockers } from "./evaluate.js";
import { goalClosure, goalReports, recommend } from "./goals.js";
import type { GoalReport, Recommendation } from "./goals.js";
import { costReport } from "./cost.js";
import type { CostReport } from "./cost.js";
import { blueprint } from "./blueprint.js";
import type { Blueprint } from "./blueprint.js";
import type { DisplayState, Evidence, LedgerEntry, LogicalLayer, Mapping, PmModel, Status, ViewName } from "./schema.js";
import type { Evaluation } from "./evaluate.js";

export interface NodeReport {
  id: string;
  name: string;
  view: ViewName;
  layer: LogicalLayer | undefined;
  status: Status;
  state: DisplayState;
  effective: boolean;
  crossViewBlocked: boolean;
  pendingReview: boolean;
  rootBlockers: string[];
  tokens: number;
  days: number;
  /** 依赖闭包包含该节点的目标 */
  goals: string[];
}

/** 依赖边（本视图）或映射边（跨视图）；from 依赖 / 被支撑于 to */
export type Edge =
  | { from: string; to: string; kind: "hard" | "soft" }
  | { from: string; to: string; kind: Mapping["kind"]; require: Mapping["require"] };

export interface Analysis {
  project: string;
  generatedAt: string;
  settings: PmModel["settings"];
  metrics: { total: number; built: number; effective: number };
  nodes: NodeReport[];
  edges: Edge[];
  goals: GoalReport[];
  recommendations: Recommendation[];
  cost: CostReport;
  blueprints: Blueprint[];
  warnings: string[];
}

export interface AnalyzeInput {
  evidence: Evidence;
  ledger: readonly LedgerEntry[];
  now: Date;
}

const edgesOf = (model: PmModel): Edge[] => [
  ...(["functional", "logical", "physical"] as const).flatMap((view) =>
    model.views[view].flatMap((node) => node.depends.map((d): Edge => ({ from: node.id, to: d.on, kind: d.kind })))),
  ...model.mappings.flatMap((m) => m.to.map((to): Edge => ({ from: m.from, to, kind: m.kind, require: m.require }))),
];

const goalMembership = (ev: Evaluation): Map<string, string[]> =>
  ev.model.goals.reduce((acc, goal) => {
    goalClosure(ev, goal).forEach((id) => acc.set(id, [...(acc.get(id) ?? []), goal.id]));
    return acc;
  }, new Map<string, string[]>());

/** 一次算出渲染五个视图所需的全部数据 */
export const analyze = (model: PmModel, input: AnalyzeInput): Analysis => {
  const ev = evaluate(model, input.evidence);
  const cost = costReport(ev, input.ledger, input.now);
  const goalsByNode = goalMembership(ev);
  const nodes = ev.graph.order.map((id): NodeReport => {
    const node = getNode(ev.graph, id);
    return {
      id,
      name: node.name,
      view: node.view,
      layer: node.layer,
      status: ev.statuses.get(id) ?? "todo",
      state: displayState(ev, id),
      effective: ev.effective.get(id) === true,
      crossViewBlocked: ev.crossViewBlocked.has(id),
      pendingReview: ev.pendingReview.has(id),
      rootBlockers: rootBlockers(ev, id),
      tokens: cost.nodes.get(id)?.tokens ?? 0,
      days: cost.nodes.get(id)?.days ?? 0,
      goals: goalsByNode.get(id) ?? [],
    };
  });
  const unknownEvidence = Object.keys(input.evidence).filter((id) => !ev.graph.nodes.has(id)).sort();
  const warnings = [
    ...(unknownEvidence.length ? [`验收结果里有未知节点：${unknownEvidence.join("、")}`] : []),
    ...(cost.unknownNodes.length ? [`成本流水里有未知节点：${cost.unknownNodes.join("、")}`] : []),
  ];
  return {
    project: model.project,
    generatedAt: input.now.toISOString(),
    settings: model.settings,
    metrics: {
      total: nodes.length,
      built: nodes.filter((n) => n.status === "done").length,
      effective: nodes.filter((n) => n.effective).length,
    },
    nodes,
    edges: edgesOf(model),
    goals: goalReports(ev),
    recommendations: recommend(ev),
    cost,
    blueprints: model.goals.filter((g) => g.journey.length > 0).map((g) => blueprint(ev, g)),
    warnings,
  };
};
