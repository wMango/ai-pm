import { describe, expect, test } from "vitest";
import { loadPmYaml, validateModel, parseEvidence, parseLedger } from "../src/index.js";
import { loadDemo } from "./helpers.js";

const base = { version: 1, project: "t" };
const errorsOf = (raw: Record<string, unknown>): string[] => {
  const result = validateModel({ ...base, ...raw });
  return result.ok ? [] : result.errors;
};

describe("loadPmYaml", () => {
  test("loads the demo project with defaults applied", () => {
    const { model } = loadDemo();
    expect(model.views.logical).toHaveLength(13);
    expect(model.settings).toEqual({ maxNodesPerView: 40, stuckDays: 5, testTimeoutSec: 300, tokenCount: "processed", runners: { ".sh": "bash {file}" } });
    expect(model.mappings.find((m) => m.from === "chatsvc")).toMatchObject({ to: ["p-app-1", "p-app-2"], require: "any" });
    expect(model.goals[0]?.journey[3]).toMatchObject({ functional: "f-cite", slice: "later" });
  });

  test("reports YAML syntax errors instead of throwing", () => {
    const result = loadPmYaml("version: 1\nproject: [unclosed");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/YAML 解析失败/);
  });

  test("reports schema errors with the field path", () => {
    const result = loadPmYaml("version: 1\nproject: t\nviews:\n  logical:\n    - { id: a, name: A }\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/views\.logical\.0\.layer/);
  });
});

describe("validateModel reference checks", () => {
  test("rejects duplicate ids across views", () => {
    const errors = errorsOf({ views: { functional: [{ id: "a", name: "A" }], physical: [{ id: "a", name: "B" }] } });
    expect(errors.join()).toMatch(/id 重复：a/);
  });

  test("rejects dependencies on unknown nodes", () => {
    const errors = errorsOf({ views: { functional: [{ id: "a", name: "A", depends: [{ on: "zzz" }] }] } });
    expect(errors.join()).toMatch(/a 依赖了不存在的节点 zzz/);
  });

  test("rejects dependencies that cross views", () => {
    const errors = errorsOf({
      views: { functional: [{ id: "a", name: "A", depends: [{ on: "b" }] }], physical: [{ id: "b", name: "B" }] },
    });
    expect(errors.join()).toMatch(/跨视图关系请用 mappings/);
  });

  test("rejects mappings in the wrong direction", () => {
    const errors = errorsOf({
      views: { logical: [{ id: "l", name: "L", layer: "service" }], physical: [{ id: "p", name: "P" }] },
      mappings: [
        { from: "l", to: "p", kind: "realized_by" },
        { from: "p", to: "l", kind: "deployed_on" },
      ],
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/realized_by 必须从 functional 指向 logical/);
    expect(errors[1]).toMatch(/deployed_on 必须从 logical 指向 physical/);
  });

  test("rejects mappings to unknown nodes", () => {
    const errors = errorsOf({
      views: { logical: [{ id: "l", name: "L", layer: "service" }] },
      mappings: [{ from: "l", to: "nope", kind: "deployed_on" }],
    });
    expect(errors.join()).toMatch(/映射引用了不存在的节点 nope/);
  });

  test("rejects goals and journeys with bad references", () => {
    const errors = errorsOf({
      views: { logical: [{ id: "l", name: "L", layer: "service" }] },
      goals: [{ id: "G1", name: "g", requires: ["nope"], journey: [{ step: "s", functional: "l" }] }],
    });
    expect(errors.join()).toMatch(/G1 requires 引用了不存在的节点 nope/);
    expect(errors.join()).toMatch(/旅程步骤「s」必须指向功能节点/);
  });

  test("rejects duplicate goal ids", () => {
    const errors = errorsOf({
      views: { physical: [{ id: "p", name: "P" }] },
      goals: [{ id: "G1", name: "a", requires: ["p"] }, { id: "G1", name: "b", requires: ["p"] }],
    });
    expect(errors.join()).toMatch(/目标 id 重复：G1/);
  });

  test("rejects two mappings of the same kind from one node", () => {
    const errors = errorsOf({
      views: { logical: [{ id: "l", name: "L", layer: "service" }], physical: [{ id: "a", name: "A" }, { id: "b", name: "B" }] },
      mappings: [
        { from: "l", to: "a", kind: "deployed_on" },
        { from: "l", to: "b", kind: "deployed_on", require: "any" },
      ],
    });
    expect(errors.join()).toMatch(/l 有多条 deployed_on 映射，请合并为一条/);
  });

  test("rejects dependency cycles and shows the path", () => {
    const errors = errorsOf({
      views: {
        logical: [
          { id: "a", name: "A", layer: "service", depends: [{ on: "b" }] },
          { id: "b", name: "B", layer: "service", depends: [{ on: "c", kind: "soft" }] },
          { id: "c", name: "C", layer: "service", depends: [{ on: "a" }] },
        ],
      },
    });
    expect(errors.join()).toMatch(/存在循环：a → b → c → a/);
  });

  test("warns when a view exceeds the node limit", () => {
    const nodes = Array.from({ length: 3 }, (_, i) => ({ id: `n${i}`, name: `N${i}` }));
    const result = validateModel({ ...base, settings: { maxNodesPerView: 2 }, views: { physical: nodes } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join()).toMatch(/physical 视图有 3 个节点，超过上限 2/);
  });
});

describe("parseEvidence / parseLedger", () => {
  test("rejects evidence where passed exceeds total", () => {
    expect(() => parseEvidence({ a: { passed: 3, total: 2 } })).toThrow(/a 的通过数 3 大于总数 2/);
  });

  test("parses ledger lines and skips blank lines", () => {
    const ledger = parseLedger('{"node":"a","at":"2026-10-26T09:00:00Z","tokens":5}\n\n');
    expect(ledger).toEqual([{ node: "a", at: "2026-10-26T09:00:00Z", tokens: 5 }]);
  });

  test("reports the line number of an invalid ledger entry", () => {
    expect(() => parseLedger('{"node":"a","at":"2026-10-26T09:00:00Z","tokens":5}\nnot json')).toThrow(/ledger 第 2 行/);
    expect(() => parseLedger('{"node":"a","at":"yesterday","tokens":5}')).toThrow(/ledger 第 1 行/);
  });
});
