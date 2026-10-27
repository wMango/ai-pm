import { describe, expect, test } from "vitest";
import { analyze } from "../../src/index.js";
import type { Evidence, LedgerEntry } from "../../src/index.js";
import { buildTimeline } from "../../src/history/timeline.js";
import type { CommitInfo, Snapshot } from "../../src/history/timeline.js";
import { model } from "../helpers.js";

// 三个节点：f 由 a 实现，a 依赖 b
const MODEL = model({
  views: {
    functional: [{ id: "f", name: "功能 F", acceptance: ["f.test.ts"] }],
    logical: [
      { id: "a", name: "组件 A", layer: "service", acceptance: ["a.test.ts"], depends: [{ on: "b" }] },
      { id: "b", name: "组件 B", layer: "data", acceptance: ["b.test.ts"] },
    ],
  },
  mappings: [{ from: "f", to: "a", kind: "realized_by" }],
  goals: [{ id: "G1", name: "目标一", requires: ["f"] }],
});
const pass = { passed: 1, total: 1, pendingReview: false };
const commit = (short: string, date: string, subject = `提交 ${short}`): CommitInfo => ({ hash: `${short}${"0".repeat(40 - short.length)}`, short, date, subject });
const snap = (c: CommitInfo | null, evidence: Evidence | null, now = c ? c.date : "2026-10-27T12:00:00Z"): Snapshot => ({
  commit: c,
  analysis: evidence ? analyze(MODEL, { evidence, ledger: [], now: new Date(now) }) : null,
  problem: evidence ? null : "untracked",
});
const entry = (node: string, at: string, tokens: number, session: string): LedgerEntry => ({ node, at, tokens, session });

const C1 = commit("aaa1111", "2026-10-25T10:00:00Z");
const C2 = commit("bbb2222", "2026-10-26T10:00:00Z");
const C3 = commit("ccc3333", "2026-10-27T10:00:00Z");

describe("buildTimeline", () => {
  test("lists newest first and describes what each commit changed", () => {
    const timeline = buildTimeline([
      snap(C3, { f: pass, a: pass, b: pass }),
      snap(C2, { f: pass, a: pass }),
      snap(C1, { f: pass }),
    ], []);
    expect(timeline.map((e) => e.key)).toEqual(["ccc3333", "bbb2222", "aaa1111"]);
    const [third, second, first] = timeline;
    expect(first?.changes).toBeNull();
    expect(second?.changes?.becameBuilt.map((r) => r.id)).toEqual(["a"]);
    expect(second?.changes?.becameEffective).toEqual([]);
    expect(third?.changes?.becameEffective.map((r) => r.name).sort()).toEqual(["功能 F", "组件 A", "组件 B"]);
    expect(third?.changes?.goalDeltas).toEqual([{ id: "G1", before: 0, after: 1 }]);
    expect(third?.metrics).toEqual({ total: 3, built: 3, effective: 3 });
  });

  test("marks a commit whose state did not change", () => {
    const timeline = buildTimeline([snap(C2, { f: pass }), snap(C1, { f: pass })], []);
    expect(timeline[0]?.unchanged).toBe(true);
    expect(timeline[1]?.unchanged).toBe(false);
  });

  test("reports modules that lost their effect", () => {
    const timeline = buildTimeline([snap(C2, { f: pass, a: pass }), snap(C1, { f: pass, a: pass, b: pass })], []);
    expect(timeline[0]?.changes?.lostEffect.map((r) => r.id).sort()).toEqual(["a", "b", "f"]);
  });

  test("tracks nodes added to and removed from the architecture", () => {
    const smaller = { ...snap(C1, { f: pass }) };
    const withExtra = analyze(model({ views: { logical: [{ id: "x", name: "新组件 X", layer: "front" }] } }), { evidence: {}, ledger: [], now: new Date(C2.date) });
    const timeline = buildTimeline([{ commit: C2, analysis: withExtra, problem: null }, smaller], []);
    expect(timeline[0]?.changes?.added.map((r) => r.id)).toEqual(["x"]);
    expect(timeline[0]?.changes?.removed.map((r) => r.id).sort()).toEqual(["a", "b", "f"]);
  });

  test("charges the sessions between two commits to the later one", () => {
    const ledger = [
      entry("a", "2026-10-25T08:00:00Z", 100, "s1"),
      entry("a", "2026-10-25T20:00:00Z", 200, "s2"),
      entry("b", "2026-10-26T09:00:00Z", 300, "s3"),
      entry("b", "2026-10-26T09:30:00Z", 50, "s3"),
      entry("f", "2026-10-27T11:00:00Z", 400, "s4"),
    ];
    const timeline = buildTimeline([snap(null, { f: pass }), snap(C2, { f: pass }), snap(C1, { f: pass })], ledger);
    expect(timeline.map((e) => e.stage)).toEqual([
      { tokens: 400, sessions: 1 },
      { tokens: 550, sessions: 2 },
      { tokens: 100, sessions: 1 },
    ]);
  });

  test("keeps commits from before the project was managed, without a page", () => {
    const timeline = buildTimeline([snap(C2, { f: pass }), snap(C1, null)], []);
    expect(timeline[1]?.state).toBe("untracked");
    expect(timeline[1]?.page).toBeNull();
    expect(timeline[0]?.changes).toBeNull();
    expect(timeline[0]?.page).toBe("bbb2222.html");
  });

  test("names the uncommitted working tree separately", () => {
    const timeline = buildTimeline([snap(null, { f: pass }), snap(C1, { f: pass })], []);
    expect(timeline[0]?.key).toBe("worktree");
    expect(timeline[0]?.commit).toBeNull();
    expect(timeline[0]?.page).toBe("worktree.html");
  });
});
