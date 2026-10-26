import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../src/cli.js";

const FIXTURE = (name: string): string => fileURLToPath(new URL(`./fixtures/kb-demo/${name}`, import.meta.url));

interface Run {
  code: number;
  out: string;
  err: string;
}

let cwd = "";
const run = (...argv: string[]): Run => {
  const out: string[] = [];
  const err: string[] = [];
  const code = runCli(argv, { cwd, out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join(""), err: err.join("") };
};
const pmDir = (): string => join(cwd, ".pm");

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "pm-cli-"));
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

/** 在临时项目里放好 .pm/ 下的指定 fixture 文件 */
const setup = (files: string[]): void => {
  mkdirSync(pmDir(), { recursive: true });
  files.forEach((f) => copyFileSync(FIXTURE(f), join(pmDir(), f)));
};

describe("pm dashboard", () => {
  test("writes .pm/dashboard.html from pm.yaml, evidence and ledger", () => {
    setup(["pm.yaml", "evidence.json", "ledger.jsonl"]);
    const r = run("dashboard", "--now", "2026-10-26T09:00:00Z");
    expect(r.code).toBe(0);
    const html = readFileSync(join(pmDir(), "dashboard.html"), "utf8");
    expect(html).toContain("智能知识库问答平台");
    expect(r.out).toMatch(/已生成 .*dashboard\.html/);
    expect(r.out).toMatch(/23 个节点 · 已完成 12 · 已生效 9/);
  });

  test("evidence and ledger are optional", () => {
    setup(["pm.yaml"]);
    const r = run("dashboard");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/已完成 0 · 已生效 0/);
  });

  test("supports a custom directory and output path", () => {
    setup(["pm.yaml"]);
    const r = run("dashboard", "--dir", ".pm", "--out", "map.html");
    expect(r.code).toBe(0);
    expect(existsSync(join(cwd, "map.html"))).toBe(true);
  });

  test("fails clearly when pm.yaml is missing", () => {
    const r = run("dashboard");
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/找不到 .*pm\.yaml/);
  });

  test("lists validation errors for an invalid pm.yaml", () => {
    setup(["pm.yaml"]);
    writeFileSync(join(pmDir(), "pm.yaml"), "version: 1\nproject: t\nviews: { logical: [{ id: a, name: A }] }\n");
    const r = run("dashboard");
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/pm\.yaml 无效/);
    expect(r.err).toMatch(/layer/);
  });

  test("fails on malformed evidence", () => {
    setup(["pm.yaml"]);
    writeFileSync(join(pmDir(), "evidence.json"), '{"login": {"passed": 5, "total": 1}}');
    const r = run("dashboard");
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/通过数 5 大于总数 1/);
  });

  test("prints warnings but still succeeds", () => {
    setup(["pm.yaml"]);
    writeFileSync(join(pmDir(), "evidence.json"), '{"ghost": {"passed": 1, "total": 1}}');
    const r = run("dashboard");
    expect(r.code).toBe(0);
    expect(r.err).toMatch(/警告：验收结果里有未知节点：ghost/);
  });

  test("strips terminal control characters before printing", () => {
    setup(["pm.yaml"]);
    // YAML 解析错误会带出源码片段，片段里可能夹着终端转义序列
    writeFileSync(join(pmDir(), "pm.yaml"), "version: 1\nproject: [\u001b]0;pwned\u0007\n");
    const r = run("dashboard");
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/YAML 解析失败/);
    expect(r.err).not.toMatch(/[\u001b\u0007]/);
  });

  test("rejects unknown commands and bad options with usage", () => {
    expect(run("deploy").code).toBe(2);
    expect(run("dashboard", "--now", "yesterday").err).toMatch(/--now 不是合法时间/);
    expect(run("dashboard", "--dir").err).toMatch(/--dir 缺少值/);
    expect(run().err).toMatch(/用法/);
  });
});
