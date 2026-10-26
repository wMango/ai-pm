import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseLedger } from "../../src/index.js";
import { makeProject, smallProject } from "./helpers.js";
import type { Project } from "./helpers.js";

// 这些测试会调用打包后的 plugin/bin/pm.mjs：npm test 之前会自动构建（见 package.json 的 pretest）
let project: Project | null = null;
const use = (p: Project): Project => (project = p);
afterEach(() => project?.cleanup());

describe("pm setup", () => {
  test("rejects unknown platforms", () => {
    const p = use(makeProject());
    const r = p.run(["setup", "cursor"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/opencode \| deepseek/);
  });

  test("opencode: installs a plugin and the skill, with the pm path baked in", () => {
    const p = use(makeProject());
    const r = p.run(["setup", "opencode"]);
    expect(r.code).toBe(0);
    const plugin = p.read(".opencode/plugins/ai-pm.js");
    expect(plugin).not.toContain("__PM_MJS__");
    expect(plugin).toMatch(/plugin\/bin\/pm\.mjs/);
    const skill = p.read(".opencode/skills/pm/SKILL.md");
    expect(skill).toMatch(/^---\nname: pm\n/);
    expect(skill).toMatch(/本机的 pm 命令是 `node ".*plugin\/bin\/pm\.mjs"`/);
    expect(skill).not.toContain("<本 skill 所在目录>");
  });

  test("deepseek: installs the skill and an idempotent AGENTS.md block", () => {
    const p = use(makeProject({ "AGENTS.md": "# 已有说明\n保留我\n" }));
    expect(p.run(["setup", "deepseek"]).code).toBe(0);
    expect(p.run(["setup", "deepseek"]).code).toBe(0);
    expect(existsSync(join(p.root, ".agents/skills/pm/SKILL.md"))).toBe(true);
    const agents = p.read("AGENTS.md");
    expect(agents).toContain("保留我");
    expect(agents.match(/<!-- ai-pm:start -->/g)).toHaveLength(1);
    expect(agents).toMatch(/pm context/);
    expect(agents).toMatch(/pm verify/);
  });

  test("--global writes under the home directory instead of the project", () => {
    const p = use(makeProject());
    const home = mkdtempSync(join(tmpdir(), "pm-home-"));
    const previous = process.env.HOME;
    process.env.HOME = home;
    try {
      expect(p.run(["setup", "opencode", "--global"]).code).toBe(0);
      expect(existsSync(join(home, ".config/opencode/plugins/ai-pm.js"))).toBe(true);
      expect(existsSync(join(home, ".config/opencode/skills/pm/SKILL.md"))).toBe(true);
      expect(existsSync(join(p.root, ".opencode"))).toBe(false);
    } finally {
      process.env.HOME = previous;
      rmSync(home, { recursive: true, force: true });
    }
  });
});

interface Hooks {
  event: (input: { event: { type: string; properties: Record<string, unknown> } }) => Promise<void>;
  "experimental.chat.system.transform": (input: { sessionID?: string }, output: { system: string[] }) => Promise<void>;
}

describe("the generated OpenCode plugin", () => {
  test("records tokens on idle and injects the project context", async () => {
    const p = use(smallProject());
    p.run(["setup", "opencode"]);
    p.run(["start", "a"]);
    const mod = (await import(pathToFileURL(join(p.root, ".opencode/plugins/ai-pm.js")).href)) as { AiPm: (ctx: { directory: string }) => Promise<Hooks> };
    const hooks = await mod.AiPm({ directory: p.root });

    const assistant = (id: string, completed: boolean, output: number) => ({
      type: "message.updated",
      properties: { info: { id, sessionID: "oc-1", role: "assistant", time: completed ? { created: 1, completed: 2 } : { created: 1 }, tokens: { input: 10, output, reasoning: 2, cache: { read: 500, write: 30 } } } },
    });
    await hooks.event({ event: assistant("m1", false, 1) });
    await hooks.event({ event: assistant("m1", true, 5) });
    await hooks.event({ event: { type: "session.idle", properties: { sessionID: "oc-1" } } });

    const ledger = parseLedger(p.read(".pm/ledger.jsonl"));
    expect(ledger).toMatchObject([{ node: "a", session: "oc-1", tokens: 47, breakdown: { input: 10, output: 7, cacheWrite: 30, cacheRead: 500 } }]);
    expect(existsSync(join(p.root, ".pm/dashboard.html"))).toBe(true);

    const output = { system: [] as string[] };
    await hooks["experimental.chat.system.transform"]({ sessionID: "oc-1" }, output);
    expect(output.system.join("\n")).toMatch(/项目地图：小项目/);
  });

  test("is a silent no-op in a project without .pm", async () => {
    const p = use(makeProject());
    p.run(["setup", "opencode"]);
    const mod = (await import(pathToFileURL(join(p.root, ".opencode/plugins/ai-pm.js")).href)) as { AiPm: (ctx: { directory: string }) => Promise<Hooks> };
    const hooks = await mod.AiPm({ directory: p.root });
    await hooks.event({ event: { type: "session.idle", properties: { sessionID: "oc-2" } } });
    const output = { system: [] as string[] };
    await hooks["experimental.chat.system.transform"]({ sessionID: "oc-2" }, output);
    expect(output.system).toEqual([]);
  });
});
