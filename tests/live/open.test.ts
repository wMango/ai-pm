import { afterEach, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "../../src/cli.js";
import { smallProject } from "../commands/helpers.js";
import type { Project } from "../commands/helpers.js";

let project: Project | null = null;
afterEach(() => {
  project?.cleanup();
  project = null;
});

/** 注入"打开"动作，记下要打开的路径，不真的弹出浏览器 */
const runWithOpener = (p: Project, argv: string[], result: { ok: boolean; error?: string } = { ok: true }): { code: number; out: string; err: string; opened: string[] } => {
  const out: string[] = [];
  const err: string[] = [];
  const opened: string[] = [];
  const code = runCli(argv, {
    cwd: p.root,
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    openPath: (target) => { opened.push(target); return result; },
  });
  return { code, out: out.join(""), err: err.join(""), opened };
};

const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
const commitAll = (p: Project): void => {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: p.root, env: GIT_ENV });
  execFileSync("git", ["add", "-A"], { cwd: p.root, env: GIT_ENV });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: p.root, env: GIT_ENV });
};

describe("pm open", () => {
  test("refreshes the map and opens it", () => {
    project = smallProject();
    const run = runWithOpener(project, ["open"]);
    expect(run.code).toBe(0);
    expect(run.opened).toEqual([join(project.root, ".pm/dashboard.html")]);
    expect(project.read(".pm/dashboard.html")).toContain("<!doctype html>");
    expect(run.out).toMatch(/已打开/);
  });

  test("opens the commit history, generating it first", () => {
    project = smallProject();
    commitAll(project);
    const run = runWithOpener(project, ["open", "history"]);
    expect(run.code).toBe(0);
    expect(run.opened).toEqual([join(project.root, ".pm/history/index.html")]);
    expect(project.read(".pm/history/index.html")).toContain("提交历史");
  });

  test("history needs git", () => {
    project = smallProject();
    const run = runWithOpener(project, ["open", "history"]);
    expect(run.code).toBe(1);
    expect(run.err).toMatch(/git/);
    expect(run.opened).toEqual([]);
  });

  test("--print only prints the path", () => {
    project = smallProject();
    const run = runWithOpener(project, ["open", "--print"]);
    expect(run.code).toBe(0);
    expect(run.opened).toEqual([]);
    expect(run.out.trim()).toBe(join(project.root, ".pm/dashboard.html"));
  });

  test("prints the path when nothing can open it", () => {
    project = smallProject();
    const run = project.run(["open"]);
    expect(run.code).toBe(0);
    expect(run.out).toContain(join(project.root, ".pm/dashboard.html"));
  });

  test("reports an opener failure but still gives the path", () => {
    project = smallProject();
    const run = runWithOpener(project, ["open"], { ok: false, error: "没有图形界面" });
    expect(run.code).toBe(1);
    expect(run.err).toMatch(/没有图形界面/);
    expect(run.err).toContain(join(project.root, ".pm/dashboard.html"));
  });

  test("rejects unknown targets", () => {
    project = smallProject();
    expect(runWithOpener(project, ["open", "somewhere"]).code).toBe(2);
  });
});

describe("pm setup preview", () => {
  test("adds a pm-map preview to .claude/launch.json and keeps existing ones", () => {
    project = smallProject();
    project.write(".claude/launch.json", JSON.stringify({ version: "0.0.1", configurations: [{ name: "web", runtimeExecutable: "npm", runtimeArgs: ["run", "dev"], port: 3000 }] }));
    const run = project.run(["setup", "preview"]);
    expect(run.code).toBe(0);
    const launch = JSON.parse(project.read(".claude/launch.json"));
    expect(launch.configurations.map((c: { name: string }) => c.name)).toEqual(["web", "pm-map"]);
    const entry = launch.configurations[1];
    expect(entry.runtimeExecutable).toBe("node");
    expect(entry.runtimeArgs.slice(1)).toEqual(["serve", "--port", "8793", "--idle-minutes", "0"]);
    expect(entry.runtimeArgs[0]).toMatch(/pm\.mjs$/);
    expect(entry.port).toBe(8793);
  });

  test("creates the file when there is none, and does not add a second entry", () => {
    project = smallProject();
    expect(project.run(["setup", "preview"]).code).toBe(0);
    const again = project.run(["setup", "preview"]);
    expect(again.code).toBe(0);
    expect(again.out).toMatch(/已经有/);
    expect(JSON.parse(project.read(".claude/launch.json")).configurations).toHaveLength(1);
  });

  test("recognises an existing entry that already runs pm serve", () => {
    project = smallProject();
    const mine = { version: "0.0.1", configurations: [{ name: "my-map", runtimeExecutable: "node", runtimeArgs: ["plugin/bin/pm.mjs", "serve"], port: 9000 }] };
    project.write(".claude/launch.json", JSON.stringify(mine));
    expect(project.run(["setup", "preview"]).out).toMatch(/my-map/);
    expect(JSON.parse(project.read(".claude/launch.json"))).toEqual(mine);
  });

  test("leaves an invalid launch.json untouched", () => {
    project = smallProject();
    project.write(".claude/launch.json", "{ not json");
    const run = project.run(["setup", "preview"]);
    expect(run.code).toBe(1);
    expect(project.read(".claude/launch.json")).toBe("{ not json");
  });
});

describe("/pm-map slash command", () => {
  const command = readFileSync(new URL("../../plugin/commands/pm-map.md", import.meta.url), "utf8");

  test("is a plugin command with a description", () => {
    expect(command.startsWith("---\n")).toBe(true);
    expect(command).toMatch(/^description: .+$/m);
    expect(command).toMatch(/^argument-hint: .+$/m);
  });

  test("prefers the in-app panel and falls back to pm open", () => {
    expect(command).toMatch(/右侧/);
    expect(command).toContain("pm open");
    expect(command).toContain("$ARGUMENTS");
    expect(command).toContain("${CLAUDE_PLUGIN_ROOT}/bin/pm.mjs");
  });
});
