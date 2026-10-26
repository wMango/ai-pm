import { describe, expect, test } from "vitest";
import { evaluate, goalReports, recommend, whatIf } from "../src/index.js";
import { loadDemo } from "./helpers.js";

const { model, evidence } = loadDemo();
const ev = evaluate(model, evidence);

describe("goalReports", () => {
  const reports = goalReports(ev);
  const byId = (id: string) => {
    const r = reports.find((g) => g.id === id);
    if (!r) throw new Error(`missing goal ${id}`);
    return r;
  };

  test("progress is effective nodes over the goal closure", () => {
    expect(byId("G1")).toMatchObject({ total: 19, effectiveCount: 9 });
    expect(byId("G1").ratio).toBeCloseTo(9 / 19);
    expect(byId("G2").ratio).toBe(1);
    expect(byId("G3")).toMatchObject({ total: 5, effectiveCount: 2 });
  });

  test("gap lists separate what to build from what is stuck", () => {
    expect(byId("G1").toBuild).toEqual(["f-ask", "f-upload", "kb", "p-app-2", "p-pgvec", "retr", "vdb"]);
    expect(byId("G1").blocked).toEqual(["chatsvc", "chatui", "parse"]);
    expect(byId("G2").toBuild).toEqual([]);
  });
});

describe("whatIf", () => {
  test("simulates finishing nodes without touching the original evaluation", () => {
    const after = whatIf(ev, ["retr", "vdb", "p-pgvec"]);
    expect(after.find((g) => g.id === "G1")?.effectiveCount).toBe(15);
    expect(goalReports(ev).find((g) => g.id === "G1")?.effectiveCount).toBe(9);
  });
});

describe("recommend", () => {
  const recs = recommend(ev);
  const planFor = (target: string) => {
    const r = recs.find((x) => x.target === target);
    if (!r) throw new Error(`missing recommendation ${target}`);
    return r;
  };

  test("a plan includes the target and everything it still waits on", () => {
    expect(planFor("retr").plan).toEqual(["p-pgvec", "retr", "vdb"]);
    expect(planFor("f-ask").plan).toEqual(["f-ask", "f-upload", "kb", "p-pgvec", "retr", "vdb"]);
  });

  test("gain is the summed goal progress in percentage points", () => {
    expect(planFor("retr").gain).toBeCloseTo(((15 - 9) / 19) * 100);
    expect(planFor("retr").goalDeltas).toEqual([{ goal: "G1", before: 9 / 19, after: 15 / 19 }]);
    expect(planFor("retr").unblocked).toEqual(["chatsvc", "chatui", "p-pgvec", "parse", "retr", "vdb"]);
  });

  test("sorted by leverage (gain per plan item), then gain", () => {
    const leverages = recs.map((r) => r.leverage);
    expect(leverages).toEqual([...leverages].sort((a, b) => b - a));
    expect(recs[0]?.target).toBe("f-billing");
    expect(recs[0]?.gain).toBeCloseTo(60);
  });

  test("nodes that move no goal are left out", () => {
    expect(recs.find((r) => r.target === "f-cite")).toBeUndefined();
  });
});
