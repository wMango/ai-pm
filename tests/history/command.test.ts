import { afterEach, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { SMALL_PM, makeProject } from "../commands/helpers.js";
import type { Project } from "../commands/helpers.js";

// 在临时 git 仓库里提交两次 .pm 状态，再留一份未提交的改动
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
const PASS = { passed: 1, total: 1 };

let project: Project | null = null;
let window: Window | null = null;
afterEach(async () => {
  await window?.happyDOM.close();
  window = null;
  project?.cleanup();
  project = null;
});

const git = (p: Project, ...args: string[]): string => execFileSync("git", args, { cwd: p.root, env: GIT_ENV, encoding: "utf8" });
const commitAll = (p: Project, message: string, date: string): void => {
  git(p, "add", "-A");
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: p.root, env: { ...GIT_ENV, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
};

const historyRepo = (): Project => {
  const p = makeProject({ "README.md": "# 早期提交\n" });
  git(p, "init", "-q", "-b", "main");
  commitAll(p, "chore: 还没接入 ai-pm", "2026-10-24T10:00:00Z");
  p.write(".pm/pm.yaml", SMALL_PM);
  p.write(".pm/evidence.json", JSON.stringify({ b: PASS }));
  p.write(".pm/ledger.jsonl", `${JSON.stringify({ node: "b", at: "2026-10-25T09:00:00Z", tokens: 1200, session: "s1" })}\n`);
  commitAll(p, "feat: 组件 B", "2026-10-25T10:00:00Z");
  p.write(".pm/evidence.json", JSON.stringify({ b: PASS, a: PASS, f: PASS }));
  commitAll(p, "feat: 组件 A 与功能 F", "2026-10-26T10:00:00Z");
  p.write(".pm/evidence.json", JSON.stringify({ a: PASS, f: PASS }));
  return p;
};

const openPage = async (p: Project, path: string): Promise<Window["document"]> => {
  window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  window.document.write(p.read(path));
  await window.happyDOM.waitUntilComplete();
  return window.document;
};

describe("pm history", () => {
  test("writes one page per commit plus an index, and keeps them out of git", () => {
    project = historyRepo();
    const run = project.run(["history"]);
    expect(run.code).toBe(0);
    expect(run.out).toMatch(/3 个提交/);
    const short = git(project, "log", "-1", "--format=%h").trim();
    expect(existsSync(join(project.root, ".pm/history/index.html"))).toBe(true);
    expect(existsSync(join(project.root, `.pm/history/${short}.html`))).toBe(true);
    expect(existsSync(join(project.root, ".pm/history/worktree.html"))).toBe(true);
    expect(project.read(".pm/.gitignore")).toContain("history/");
  });

  test("a commit page shows the map as it was at that commit", async () => {
    project = historyRepo();
    project.run(["history"]);
    const first = git(project, "log", "--format=%h", "-1", "HEAD~1").trim();
    const doc = await openPage(project, `.pm/history/${first}.html`);
    expect(doc.querySelectorAll(".render-error")).toHaveLength(0);
    expect(doc.querySelector(".crumb")?.textContent).toContain(first);
    expect(doc.querySelector('.crumb a[href="index.html"]')).not.toBeNull();
    expect(doc.querySelector('#map-svg g.node[data-id="a"]')?.getAttribute("data-state")).not.toBe("ok");
  });

  test("the index lists every commit with what it changed", async () => {
    project = historyRepo();
    project.run(["history"]);
    const doc = await openPage(project, ".pm/history/index.html");
    expect(doc.querySelectorAll(".render-error")).toHaveLength(0);
    const rows = [...doc.querySelectorAll("#history-list .commit-row")];
    expect(rows).toHaveLength(4);
    expect(rows[0]?.textContent).toMatch(/未提交/);
    expect(rows[1]?.textContent).toContain("组件 A 与功能 F");
    expect(rows[1]?.textContent).toMatch(/新增生效/);
    expect(rows[1]?.querySelector("a[href]")?.getAttribute("href")).toMatch(/^[0-9a-f]+\.html$/);
    expect(rows[3]?.textContent).toMatch(/尚未接入/);
    expect(rows[3]?.querySelector("a[href]")).toBeNull();
    expect(doc.querySelectorAll("#history-chart circle").length).toBeGreaterThanOrEqual(3);
  });

  test("the current dashboard links to the history once it exists", () => {
    project = historyRepo();
    project.run(["history"]);
    project.run(["dashboard"]);
    expect(project.read(".pm/dashboard.html")).toContain('href="history/index.html"');
  });

  test("explains when the project is not a git repository", () => {
    project = makeProject({ ".pm/pm.yaml": SMALL_PM });
    const run = project.run(["history"]);
    expect(run.code).toBe(1);
    expect(run.err).toMatch(/git/);
  });
});
