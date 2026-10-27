// pmdir 验收：.pm 目录读写契约，对应 .pm/acceptance/pmdir.feature
// 每条用例在独立的临时目录里运行，不碰真实的 .pm
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadModel, pmPaths, readEvidence, readLedger, writeJson } from "../../src/commands/shared.js";
import type { PmPaths } from "../../src/commands/shared.js";

let root: string;
let paths: PmPaths;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pmdir-acceptance-"));
  paths = pmPaths(root);
  writeJson(paths.file(".keep.json"), {});
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (name: string, content: string): void => writeFileSync(paths.file(name), content);

describe("pmdir 验收", () => {
  test("没有 pm.yaml 时给出可操作的提示", () => {
    expect(() => loadModel(paths)).toThrow(/先运行 pm init/);
  });

  test("pm.yaml 无效时逐条列出原因", () => {
    write("pm.yaml", "version: 1\nproject: t\nviews:\n  functional:\n    - { id: a, name: A, depends: [{ on: x }, { on: y }] }\n");
    expect(() => loadModel(paths)).toThrow(/^pm\.yaml 无效：\n {2}- a 依赖了不存在的节点 x\n {2}- a 依赖了不存在的节点 y$/);
  });

  test("合法的 pm.yaml 加载为模型", () => {
    write("pm.yaml", "version: 1\nproject: t\nviews:\n  physical:\n    - { id: p, name: P }\n");
    expect(loadModel(paths).model.views.physical[0]?.id).toBe("p");
  });

  test("evidence.json 缺失视为空，损坏时报错", () => {
    expect(readEvidence(paths)).toEqual({});
    write("evidence.json", "{ not json");
    expect(() => readEvidence(paths)).toThrow("evidence.json 不是合法 JSON");
  });

  test("ledger.jsonl 的坏行被跳过并给出警告", () => {
    write("ledger.jsonl", `${JSON.stringify({ node: "a", at: "2026-10-27T00:00:00Z", tokens: 10 })}\n\n{ broken\n`);
    const { entries, warnings } = readLedger(paths);
    expect(entries).toHaveLength(1);
    expect(warnings).toEqual(["ledger 第 3 行无法解析，已跳过"]);
  });

  test("写入是原子的：格式化 JSON，不留临时文件", () => {
    writeJson(paths.file("evidence.json"), { a: { passed: 1, total: 1 } });
    expect(readFileSync(paths.file("evidence.json"), "utf8")).toBe('{\n  "a": {\n    "passed": 1,\n    "total": 1\n  }\n}\n');
    expect(readdirSync(paths.pmDir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});
