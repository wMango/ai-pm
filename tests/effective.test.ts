import { describe, expect, test } from "vitest";
import { evaluate, rootBlockers, displayState, planFor } from "../src/index.js";
import { done, failing, loadDemo, model } from "./helpers.js";

describe("deriveStatus (via evaluate)", () => {
  const m = model({
    views: {
      physical: [
        { id: "none", name: "无验收" },
        { id: "unrun", name: "未运行", acceptance: ["x"] },
        { id: "fail", name: "未通过", acceptance: ["x"] },
        { id: "pass", name: "通过", acceptance: ["x"] },
        { id: "empty", name: "零用例", acceptance: ["x"] },
      ],
    },
  });
  const ev = evaluate(m, {
    none: done(),
    fail: { passed: 1, total: 2, pendingReview: false },
    pass: done(2),
    empty: { passed: 0, total: 0, pendingReview: false },
  });

  test("no acceptance tests means todo, even with evidence", () => expect(ev.statuses.get("none")).toBe("todo"));
  test("acceptance declared but not run means doing", () => expect(ev.statuses.get("unrun")).toBe("doing"));
  test("partially passing means doing", () => expect(ev.statuses.get("fail")).toBe("doing"));
  test("all passing means done", () => expect(ev.statuses.get("pass")).toBe("done"));
  test("zero test cases never count as done", () => expect(ev.statuses.get("empty")).toBe("doing"));
});

describe("computeEffective on the demo project", () => {
  const { model: m, evidence } = loadDemo();
  const ev = evaluate(m, evidence);
  const effectiveIds = [...ev.effective].filter(([, v]) => v).map(([k]) => k).sort();

  test("only nodes whose whole support chain passes are effective", () => {
    expect(effectiveIds).toEqual(["auth", "f-login", "llm", "login", "oss", "p-app-1", "p-pg", "p-s3", "userdb"]);
  });

  test("display state separates built-but-blocked from effective", () => {
    expect(displayState(ev, "chatui")).toBe("blocked");
    expect(displayState(ev, "login")).toBe("ok");
    expect(displayState(ev, "kb")).toBe("doing");
    expect(displayState(ev, "vdb")).toBe("todo");
  });

  test("root blockers follow only the unsatisfied supports", () => {
    // p-app-2 is down but chatsvc only needs any replica, so it is not a blocker
    expect(rootBlockers(ev, "chatui")).toEqual(["p-pgvec", "retr", "vdb"]);
    expect(rootBlockers(ev, "login")).toEqual([]);
  });

  test("a node that is not done lists its own missing upstream, not itself", () => {
    expect(rootBlockers(ev, "retr")).toEqual(["p-pgvec", "vdb"]);
  });

  test("pending review flags are carried through", () => {
    expect(ev.pendingReview.has("auth")).toBe(true);
    expect(ev.pendingReview.has("login")).toBe(false);
  });
});

describe("cross-view propagation", () => {
  const m = model({
    views: {
      functional: [{ id: "f", name: "F", acceptance: ["x"] }],
      logical: [{ id: "svc", name: "SVC", layer: "service", acceptance: ["x"] }],
      physical: [
        { id: "a", name: "A", acceptance: ["x"] },
        { id: "b", name: "B", acceptance: ["x"] },
      ],
    },
    mappings: [
      { from: "f", to: "svc", kind: "realized_by" },
      { from: "svc", to: ["a", "b"], kind: "deployed_on", require: "any" },
    ],
  });

  test("any-group is satisfied by one healthy replica", () => {
    const ev = evaluate(m, { f: done(), svc: done(), a: done(), b: failing() });
    expect(ev.effective.get("f")).toBe(true);
  });

  test("blockage propagates physical → logical → functional", () => {
    const ev = evaluate(m, { f: done(), svc: done(), a: failing(), b: failing() });
    expect(ev.effective.get("svc")).toBe(false);
    expect(ev.effective.get("f")).toBe(false);
    // any 组只需修好一个副本，根因报代价最小的修复路径
    expect(rootBlockers(ev, "f")).toEqual(["a"]);
    expect(ev.crossViewBlocked.has("svc")).toBe(true);
  });

  test("blockage never propagates downward", () => {
    const ev = evaluate(m, { f: failing(), svc: done(), a: done(), b: done() });
    expect(ev.effective.get("svc")).toBe(true);
  });

  test("all-groups need every target", () => {
    const strict = model({
      views: {
        logical: [{ id: "svc", name: "SVC", layer: "service", acceptance: ["x"] }],
        physical: [
          { id: "a", name: "A", acceptance: ["x"] },
          { id: "b", name: "B", acceptance: ["x"] },
        ],
      },
      mappings: [{ from: "svc", to: ["a", "b"], kind: "deployed_on" }],
    });
    const ev = evaluate(strict, { svc: done(), a: done(), b: failing() });
    expect(ev.effective.get("svc")).toBe(false);
    expect(rootBlockers(ev, "svc")).toEqual(["b"]);
  });

  test("soft dependencies do not block", () => {
    const soft = model({
      views: {
        logical: [
          { id: "x", name: "X", layer: "service", acceptance: ["t"], depends: [{ on: "y", kind: "soft" }] },
          { id: "y", name: "Y", layer: "service" },
        ],
      },
    });
    expect(evaluate(soft, { x: done() }).effective.get("x")).toBe(true);
  });
});

describe("plans for any-groups and deep graphs", () => {
  test("an unsatisfied any-group only needs its cheapest target", () => {
    const m = model({
      views: {
        functional: [{ id: "f", name: "F", acceptance: ["x"] }],
        logical: [
          { id: "l1", name: "L1", layer: "service", acceptance: ["x"] },
          { id: "l2", name: "L2", layer: "service", acceptance: ["x"], depends: [{ on: "l3" }] },
          { id: "l3", name: "L3", layer: "data" },
        ],
      },
      mappings: [{ from: "f", to: ["l2", "l1"], kind: "realized_by", require: "any" }],
    });
    const ev = evaluate(m, {});
    expect(planFor(ev, "f")).toEqual(["f", "l1"]);
  });

  test("stays fast on deep diamond-shaped graphs", () => {
    const LAYERS = 30;
    const nodes = Array.from({ length: LAYERS }, (_, i) => [
      { id: `a${i}`, name: `A${i}`, layer: "service", acceptance: ["x"], depends: i ? [{ on: `a${i - 1}` }, { on: `b${i - 1}` }] : [] },
      { id: `b${i}`, name: `B${i}`, layer: "service", acceptance: ["x"], depends: i ? [{ on: `a${i - 1}` }, { on: `b${i - 1}` }] : [] },
    ]).flat();
    const m = model({ settings: { maxNodesPerView: 100 }, views: { logical: nodes } });
    const evidence = Object.fromEntries(nodes.slice(2).map((n) => [n.id, done()]));
    const start = performance.now();
    expect(rootBlockers(evaluate(m, evidence), `a${LAYERS - 1}`)).toEqual(["a0", "b0"]);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

