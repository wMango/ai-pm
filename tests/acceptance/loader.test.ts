// loader 验收：接口契约测试，对应 .pm/acceptance/loader.feature
// 上游 pmdir 用内存中的 YAML 文本代替，不读写磁盘
import { describe, expect, test } from "vitest";
import { loadPmYaml } from "../../src/index.js";

const errorsOf = (text: string): string[] => {
  const result = loadPmYaml(text);
  return result.ok ? [] : result.errors;
};

describe("loader 验收", () => {
  test("合法的 pm.yaml 得到补齐默认值的模型", () => {
    const result = loadPmYaml(`
version: 1
project: demo
views:
  functional:
    - { id: f-a, name: 功能A }
  logical:
    - { id: l-a, name: 组件A, layer: service }
mappings:
  - { from: f-a, to: l-a, kind: realized_by }
goals:
  - { id: G1, name: 目标, requires: [f-a], journey: [{ step: 第一步, functional: f-a }] }
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.model.settings).toMatchObject({ maxNodesPerView: 40, stuckDays: 5, runners: { ".sh": "bash {file}" } });
    expect(result.model.mappings[0]).toMatchObject({ to: ["l-a"], require: "all" });
    expect(result.model.goals[0]?.journey[0]?.slice).toBe("now");
  });

  test("YAML 语法错误不抛异常，而是返回中文提示", () => {
    const errors = errorsOf("version: 1\nproject: [unclosed");
    expect(errors[0]).toMatch(/^YAML 解析失败/);
  });

  test("字段错误指出出错的字段路径", () => {
    const errors = errorsOf("version: 1\nproject: t\nviews:\n  logical:\n    - { id: a, name: A }\n");
    expect(errors.join("\n")).toContain("views.logical.0.layer");
  });

  test("结构性错误逐条给出中文原因", () => {
    const errors = errorsOf(`
version: 1
project: t
views:
  functional:
    - { id: dup, name: 重复 }
    - { id: f-a, name: A, depends: [{ on: ghost }, { on: p-a }] }
  logical:
    - { id: l-a, name: L, layer: service }
  physical:
    - { id: dup, name: 重复 }
    - { id: p-a, name: P }
mappings:
  - { from: l-a, to: p-a, kind: realized_by }
goals:
  - { id: G1, name: g, requires: [f-a], journey: [{ step: 错步, functional: l-a }] }
`).join("\n");
    expect(errors).toMatch(/id 重复：dup/);
    expect(errors).toMatch(/f-a 依赖了不存在的节点 ghost/);
    expect(errors).toMatch(/跨视图关系请用 mappings/);
    expect(errors).toMatch(/映射方向错误/);
    expect(errors).toMatch(/旅程步骤「错步」必须指向功能节点/);
  });

  test("依赖与映射形成环时指出环上的节点", () => {
    const errors = errorsOf(`
version: 1
project: t
views:
  functional:
    - { id: a, name: A, depends: [{ on: b }] }
    - { id: b, name: B, depends: [{ on: a }] }
`).join("\n");
    expect(errors).toMatch(/存在循环/);
    expect(errors).toMatch(/a/);
    expect(errors).toMatch(/b/);
  });

  test("节点超过上限只警告不报错", () => {
    const result = loadPmYaml(`
version: 1
project: t
settings: { maxNodesPerView: 1 }
views:
  physical:
    - { id: p1, name: P1 }
    - { id: p2, name: P2 }
`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join()).toMatch(/超过上限/);
  });
});
