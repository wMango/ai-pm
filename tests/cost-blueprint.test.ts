import { describe, expect, test } from "vitest";
import { analyze, blueprint, costReport, evaluate } from "../src/index.js";
import { DEMO_NOW, loadDemo } from "./helpers.js";

const { model, evidence, ledger } = loadDemo();
const ev = evaluate(model, evidence);

describe("costReport", () => {
  const cost = costReport(ev, ledger, DEMO_NOW);

  test("sums tokens per node and measures elapsed days", () => {
    expect(cost.nodes.get("kb")).toEqual({ tokens: 610000, days: 6 });
    // done nodes stop the clock at their last session
    expect(cost.nodes.get("chatsvc")).toEqual({ tokens: 520000, days: 5 });
    expect(cost.nodes.get("vdb")).toBeUndefined();
  });

  test("sunk tokens are spent on nodes that are not effective", () => {
    expect(cost.totalTokens).toBe(1310000);
    expect(cost.sunkTokens).toBe(1130000);
    expect(cost.byState).toEqual({ ok: 180000, blocked: 520000, doing: 610000, todo: 0 });
  });

  test("flags doing nodes past the stuck threshold", () => {
    expect(cost.stuck).toEqual(["kb"]);
  });

  test("attributes tokens to every goal whose closure contains the node", () => {
    expect(cost.byGoal).toEqual({ G1: 1310000, G2: 180000, G3: 0 });
  });

  test("ignores ledger entries for unknown nodes but reports them", () => {
    const extra = costReport(ev, [...ledger, { node: "ghost", at: "2026-10-26T09:00:00Z", tokens: 9 }], DEMO_NOW);
    expect(extra.totalTokens).toBe(1310000);
    expect(extra.unknownNodes).toEqual(["ghost"]);
  });
});

describe("blueprint", () => {
  const goal = model.goals[0];
  if (!goal) throw new Error("demo goal missing");
  const bp = blueprint(ev, goal);
  const step = (name: string) => {
    const s = bp.steps.find((x) => x.step === name);
    if (!s) throw new Error(`missing step ${name}`);
    return s;
  };

  test("lanes are derived from mappings and the dependency closure", () => {
    expect(step("登录").lanes).toEqual({ front: ["login"], back: ["auth"], support: ["userdb", "p-pg"] });
    expect(step("提问").lanes).toEqual({
      front: ["chatui"],
      back: ["chatsvc", "retr"],
      support: ["vdb", "llm", "p-pgvec", "p-app-1", "p-app-2"],
    });
  });

  test("a step is usable only when its functional node is effective", () => {
    expect(step("登录").status).toBe("ok");
    expect(step("上传文档").status).toBe("broken");
  });

  test("broken steps point at the deepest blocker in the column", () => {
    expect(step("提问").root).toBe("p-pgvec");
    expect(step("上传文档").root).toBe("p-pgvec");
  });

  test("a step without any realization is a mapping gap", () => {
    expect(step("查看引用")).toMatchObject({ status: "gap", slice: "later", root: null });
  });

  test("falls back to the functional node when nothing in the column blocks", () => {
    const bpUnrun = blueprint(evaluate(model, { ...evidence, "f-login": { passed: 0, total: 2, pendingReview: false } }), goal);
    expect(bpUnrun.steps[0]).toMatchObject({ status: "broken", root: "f-login" });
  });

  test("summary counts usable steps inside the slice", () => {
    expect(bp.summary).toEqual({ inScope: 3, usable: 1 });
  });
});

describe("analyze", () => {
  test("bundles every view for rendering", () => {
    const a = analyze(model, { evidence, ledger, now: DEMO_NOW });
    expect(a.project).toBe("智能知识库问答平台");
    expect(a.nodes).toHaveLength(23);
    expect(a.nodes.find((n) => n.id === "chatui")).toMatchObject({
      view: "logical", layer: "front", state: "blocked", rootBlockers: ["p-pgvec", "retr", "vdb"], tokens: 0,
    });
    expect(a.nodes.find((n) => n.id === "auth")).toMatchObject({ pendingReview: true });
    expect(a.metrics).toEqual({ total: 23, built: 12, effective: 9 });
    expect(a.blueprints.map((b) => b.goal)).toEqual(["G1"]);
    expect(a.recommendations.length).toBeGreaterThan(0);
  });

  test("exposes edges, goal membership and settings for the dashboard", () => {
    const a = analyze(model, { evidence, ledger, now: DEMO_NOW });
    expect(a.edges).toContainEqual({ from: "chatui", to: "chatsvc", kind: "hard" });
    expect(a.edges).toContainEqual({ from: "chatsvc", to: "p-app-2", kind: "deployed_on", require: "any" });
    expect(a.edges).toContainEqual({ from: "f-ask", to: "chatui", kind: "realized_by", require: "all" });
    expect(a.nodes.find((n) => n.id === "login")?.goals).toEqual(["G1", "G2"]);
    expect(a.nodes.find((n) => n.id === "f-cite")?.goals).toEqual([]);
    expect(a.settings).toMatchObject({ maxNodesPerView: 40, stuckDays: 5 });
    expect(a.generatedAt).toBe("2026-10-26T09:00:00.000Z");
  });

  test("warns about evidence for unknown nodes", () => {
    const a = analyze(model, { evidence: { ...evidence, ghost: { passed: 1, total: 1, pendingReview: false } }, ledger: [], now: DEMO_NOW });
    expect(a.warnings.join()).toMatch(/验收结果里有未知节点：ghost/);
  });
});
