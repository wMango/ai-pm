import { displayState } from "./evaluate.js";
import type { Evaluation } from "./evaluate.js";
import { goalClosure } from "./goals.js";
import { UNASSIGNED_NODE } from "./schema.js";
import type { DisplayState, LedgerEntry } from "./schema.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface NodeCost {
  tokens: number;
  /** 从第一次会话到完成（最后一次会话）或到现在的天数 */
  days: number;
}

export interface CostReport {
  nodes: ReadonlyMap<string, NodeCost>;
  totalTokens: number;
  /** 花在尚未生效节点上的 token */
  sunkTokens: number;
  byState: Record<DisplayState, number>;
  /** 按目标汇总；共享节点会计入每个相关目标 */
  byGoal: Record<string, number>;
  /** 进行中且超过 stuckDays 的节点 */
  stuck: string[];
  /** ledger 里出现、模型里不存在的节点 */
  unknownNodes: string[];
  /** 未声明当前模块时消耗的 token */
  unassignedTokens: number;
}

const nodeCosts = (ev: Evaluation, entries: readonly LedgerEntry[], now: Date): Map<string, NodeCost> => {
  // 单次遍历累加，ledger 只增不减，行数可能很大
  const totals = new Map<string, { tokens: number; first: number; last: number }>();
  for (const e of entries) {
    const t = Date.parse(e.at);
    const prev = totals.get(e.node);
    totals.set(e.node, prev
      ? { tokens: prev.tokens + e.tokens, first: Math.min(prev.first, t), last: Math.max(prev.last, t) }
      : { tokens: e.tokens, first: t, last: t });
  }
  return new Map(
    [...totals].map(([id, { tokens, first, last }]) => {
      const end = ev.statuses.get(id) === "done" ? last : now.getTime();
      return [id, { tokens, days: (end - first) / MS_PER_DAY }];
    }),
  );
};

export const costReport = (ev: Evaluation, ledger: readonly LedgerEntry[], now: Date): CostReport => {
  const known = ledger.filter((e) => ev.graph.nodes.has(e.node));
  const unknownNodes = [...new Set(ledger.filter((e) => !ev.graph.nodes.has(e.node) && e.node !== UNASSIGNED_NODE).map((e) => e.node))].sort();
  const unassignedTokens = ledger.filter((e) => e.node === UNASSIGNED_NODE).reduce((acc, e) => acc + e.tokens, 0);
  const nodes = nodeCosts(ev, known, now);
  const tokensOf = (id: string): number => nodes.get(id)?.tokens ?? 0;
  const sum = (ids: readonly string[]): number => ids.reduce((acc, id) => acc + tokensOf(id), 0);

  const byState = [...nodes.keys()].reduce<Record<DisplayState, number>>(
    (acc, id) => {
      const state = displayState(ev, id);
      return { ...acc, [state]: acc[state] + tokensOf(id) };
    },
    { ok: 0, blocked: 0, doing: 0, todo: 0 },
  );

  return {
    nodes,
    totalTokens: sum([...nodes.keys()]),
    sunkTokens: sum([...nodes.keys()].filter((id) => !ev.effective.get(id))),
    byState,
    byGoal: Object.fromEntries(ev.model.goals.map((g) => [g.id, sum(goalClosure(ev, g))])),
    stuck: [...nodes]
      .filter(([id, c]) => ev.statuses.get(id) === "doing" && c.days > ev.model.settings.stuckDays)
      .map(([id]) => id)
      .sort(),
    unknownNodes,
    unassignedTokens,
  };
};
