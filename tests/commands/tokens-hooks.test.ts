import { afterEach, describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseTranscriptUsage, tokensOf, parseLedger } from "../../src/index.js";
import { assistantLine, makeProject, smallProject } from "./helpers.js";
import type { Project } from "./helpers.js";

let project: Project | null = null;
const use = (p: Project): Project => (project = p);
afterEach(() => project?.cleanup());

describe("parseTranscriptUsage", () => {
  test("counts each assistant message once even when streamed over several lines", () => {
    const text = [
      assistantLine("m1", { input: 1, output: 5, cacheWrite: 100, cacheRead: 1000 }),
      assistantLine("m1", { input: 1, output: 9, cacheWrite: 100, cacheRead: 1000 }),
      assistantLine("m2", { input: 2, output: 3, cacheWrite: 0, cacheRead: 2000 }),
      JSON.stringify({ type: "user", message: { content: "hi" } }),
      "not json",
      "",
    ].join("\n");
    expect(parseTranscriptUsage(text)).toEqual({ input: 3, output: 12, cacheWrite: 100, cacheRead: 3000 });
  });

  test("processed excludes cache reads, all includes them", () => {
    const b = { input: 3, output: 12, cacheWrite: 100, cacheRead: 3000 };
    expect(tokensOf(b, "processed")).toBe(115);
    expect(tokensOf(b, "all")).toBe(3115);
  });
});

describe("pm record", () => {
  const transcript = (p: Project, lines: string[]): string => {
    p.write("transcript.jsonl", lines.join("\n"));
    return join(p.root, "transcript.jsonl");
  };
  const ledgerOf = (p: Project) => parseLedger(p.read(".pm/ledger.jsonl"));

  test("appends this session's tokens to the current module", () => {
    const p = use(smallProject());
    p.run(["start", "a"]);
    const t = transcript(p, [assistantLine("m1", { input: 10, output: 20, cacheWrite: 30, cacheRead: 999 })]);
    expect(p.run(["record", "--session", "s1", "--transcript", t]).code).toBe(0);
    expect(ledgerOf(p)).toMatchObject([{ node: "a", session: "s1", tokens: 60, breakdown: { cacheRead: 999 } }]);
  });

  test("is incremental: re-running adds only the new tokens", () => {
    const p = use(smallProject());
    p.run(["start", "a"]);
    const t1 = transcript(p, [assistantLine("m1", { output: 10 })]);
    p.run(["record", "--session", "s1", "--transcript", t1]);
    p.run(["record", "--session", "s1", "--transcript", t1]);
    expect(ledgerOf(p)).toHaveLength(1);
    p.run(["start", "b"]);
    const t2 = transcript(p, [assistantLine("m1", { output: 10 }), assistantLine("m2", { output: 7 })]);
    p.run(["record", "--session", "s1", "--transcript", t2]);
    expect(ledgerOf(p).map((e) => [e.node, e.tokens])).toEqual([["a", 10], ["b", 7]]);
  });

  test("tokens spent before any module is declared go to unassigned", () => {
    const p = use(smallProject());
    const t = transcript(p, [assistantLine("m1", { output: 4 })]);
    const r = p.run(["record", "--session", "s1", "--transcript", t]);
    expect(ledgerOf(p)).toMatchObject([{ node: "unassigned", tokens: 4 }]);
    expect(r.err).toMatch(/未声明当前模块/);
  });

  test("an unreadable transcript records nothing and warns", () => {
    const p = use(smallProject());
    const r = p.run(["record", "--session", "s1", "--transcript", join(p.root, "missing.jsonl")]);
    expect(r.code).toBe(0);
    expect(r.err).toMatch(/读不到会话记录/);
    expect(existsSync(join(p.root, ".pm/ledger.jsonl"))).toBe(false);
  });
});

describe("pm context", () => {
  test("summarises progress, next steps and review items for the AI", () => {
    const p = use(smallProject());
    p.run(["lock", "a"]);
    p.run(["verify"]);
    const r = p.run(["context"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/小项目/);
    expect(r.out).toMatch(/生效 0\/3/);
    expect(r.out).toMatch(/G1 目标一：0%/);
    expect(r.out).toMatch(/下一步/);
    expect(r.out).toMatch(/待复核：功能 F（f）、组件 B（b）/);
  });

  test("prints nothing for a project without .pm", () => {
    const p = use(makeProject());
    const r = p.run(["context"]);
    expect(r).toMatchObject({ code: 0, out: "" });
  });
});

describe("pm hook", () => {
  const payload = (p: Project, extra: Record<string, unknown> = {}): string =>
    JSON.stringify({ session_id: "s9", transcript_path: join(p.root, "transcript.jsonl"), cwd: p.root, ...extra });

  test("session-start injects the context", () => {
    const p = use(smallProject());
    const r = p.run(["hook", "session-start"], payload(p));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/项目地图/);
  });

  test("stop records tokens and refreshes the dashboard without running tests", () => {
    const p = use(smallProject());
    p.run(["start", "b"]);
    p.write("transcript.jsonl", assistantLine("m1", { output: 8 }));
    const r = p.run(["hook", "stop"], payload(p));
    expect(r.code).toBe(0);
    expect(parseLedger(p.read(".pm/ledger.jsonl"))).toMatchObject([{ node: "b", session: "s9", tokens: 8 }]);
    expect(existsSync(join(p.root, ".pm/dashboard.html"))).toBe(true);
    expect(existsSync(join(p.root, ".pm/evidence.json"))).toBe(false);
  });

  test("session-end --sync records, verifies and refreshes (once runners are trusted)", () => {
    const p = use(smallProject());
    p.run(["trust"]);
    p.run(["start", "a"]);
    p.write("transcript.jsonl", assistantLine("m1", { output: 8 }));
    const r = p.run(["hook", "session-end", "--sync"], payload(p));
    expect(r.code).toBe(0);
    expect(JSON.parse(p.read(".pm/evidence.json")).a).toMatchObject({ passed: 1 });
    expect(existsSync(join(p.root, ".pm/dashboard.html"))).toBe(true);
    expect(p.read(".pm/last-run.log")).toMatch(/验收/);
  });

  test("hooks are silent no-ops outside managed projects", () => {
    const p = use(makeProject());
    const r = p.run(["hook", "stop"], payload(p));
    expect(r).toMatchObject({ code: 0, out: "", err: "" });
  });

  test("hooks never fail the session, even on bad input", () => {
    const p = use(smallProject());
    const r = p.run(["hook", "stop"], "{not json");
    expect(r.code).toBe(0);
    expect(r.err).toMatch(/hook 输入不是合法 JSON/);
  });
});
