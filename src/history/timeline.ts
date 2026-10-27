// 按提交回看项目：每个提交是一个阶段的完成点，比较相邻提交得出"这一步改变了什么"
import type { Analysis } from "../analyze.js";
import type { LedgerEntry } from "../schema.js";

export interface CommitInfo {
  hash: string;
  short: string;
  /** 提交时间（ISO） */
  date: string;
  subject: string;
}

/** 某个提交（或未提交的工作区）上的项目状态；那时还没有 .pm 或文件无效时 analysis 为 null */
export interface Snapshot {
  commit: CommitInfo | null;
  analysis: Analysis | null;
  problem: "untracked" | "invalid" | null;
  note?: string;
}

export interface NodeRef {
  id: string;
  name: string;
}

export interface Changes {
  becameEffective: NodeRef[];
  lostEffect: NodeRef[];
  /** 验收通过了，但还没生效（被上游卡住） */
  becameBuilt: NodeRef[];
  added: NodeRef[];
  removed: NodeRef[];
  goalDeltas: { id: string; before: number; after: number }[];
}

export interface HistoryEntry {
  /** 短哈希；工作区为 worktree */
  key: string;
  commit: CommitInfo | null;
  state: "ok" | "untracked" | "invalid";
  note: string | null;
  page: string | null;
  metrics: Analysis["metrics"] | null;
  goals: { id: string; name: string; ratio: number }[];
  /** 与上一个有效快照相比；最早的有效快照为 null */
  changes: Changes | null;
  unchanged: boolean;
  /** 上一个提交之后、到这个提交为止的会话投入 */
  stage: { tokens: number; sessions: number };
}

export const WORKTREE_KEY = "worktree";

const refsOf = (analysis: Analysis, ids: readonly string[]): NodeRef[] =>
  ids.map((id) => ({ id, name: analysis.nodes.find((n) => n.id === id)?.name ?? id }));

export const diffAnalyses = (before: Analysis, after: Analysis): Changes => {
  const prev = new Map(before.nodes.map((n) => [n.id, n]));
  const next = new Map(after.nodes.map((n) => [n.id, n]));
  const kept = after.nodes.filter((n) => prev.has(n.id));
  const pick = (test: (was: Analysis["nodes"][number], now: Analysis["nodes"][number]) => boolean): string[] =>
    kept.filter((n) => test(prev.get(n.id) as Analysis["nodes"][number], n)).map((n) => n.id);
  const ratioBefore = new Map(before.goals.map((g) => [g.id, g.ratio]));
  return {
    becameEffective: refsOf(after, pick((was, now) => !was.effective && now.effective)),
    lostEffect: refsOf(after, pick((was, now) => was.effective && !now.effective)),
    becameBuilt: refsOf(after, pick((was, now) => was.status !== "done" && now.status === "done" && !now.effective)),
    added: refsOf(after, after.nodes.filter((n) => !prev.has(n.id)).map((n) => n.id)),
    removed: refsOf(before, before.nodes.filter((n) => !next.has(n.id)).map((n) => n.id)),
    goalDeltas: after.goals
      .map((g) => ({ id: g.id, before: ratioBefore.get(g.id) ?? 0, after: g.ratio }))
      .filter((d) => d.before !== d.after),
  };
};

const isEmpty = (c: Changes): boolean =>
  !c.becameEffective.length && !c.lostEffect.length && !c.becameBuilt.length && !c.added.length && !c.removed.length && !c.goalDeltas.length;

/** (from, to] 时间窗内的 token 与会话数；没有会话 id 的记录各算一次 */
const stageOf = (ledger: readonly LedgerEntry[], from: number, to: number): HistoryEntry["stage"] => {
  const inside = ledger.filter((e) => { const t = Date.parse(e.at); return t > from && t <= to; });
  const sessions = new Set(inside.map((e, i) => e.session ?? `#${i}`));
  return { tokens: inside.reduce((sum, e) => sum + e.tokens, 0), sessions: sessions.size };
};

/** snapshots 按从新到旧排列；工作区（commit 为 null）只能是第一个 */
export const buildTimeline = (snapshots: readonly Snapshot[], ledger: readonly LedgerEntry[]): HistoryEntry[] =>
  snapshots.map((snap, i): HistoryEntry => {
    const key = snap.commit ? snap.commit.short : WORKTREE_KEY;
    const older = snapshots.slice(i + 1);
    const previous = older.find((s) => s.analysis)?.analysis ?? null;
    const to = snap.commit ? Date.parse(snap.commit.date) : Number.POSITIVE_INFINITY;
    const olderCommit = older.find((s) => s.commit)?.commit;
    const stage = stageOf(ledger, olderCommit ? Date.parse(olderCommit.date) : Number.NEGATIVE_INFINITY, to);
    const base = { key, commit: snap.commit, note: snap.note ?? null, stage };
    if (!snap.analysis) {
      return { ...base, state: snap.problem ?? "invalid", page: null, metrics: null, goals: [], changes: null, unchanged: false };
    }
    const changes = previous ? diffAnalyses(previous, snap.analysis) : null;
    return {
      ...base,
      state: "ok",
      page: `${key}.html`,
      metrics: snap.analysis.metrics,
      goals: snap.analysis.goals.map((g) => ({ id: g.id, name: g.name, ratio: g.ratio })),
      changes,
      unchanged: changes ? isEmpty(changes) : false,
    };
  });
