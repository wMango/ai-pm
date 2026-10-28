import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { smallProject, makeProject } from "./helpers.js";
import type { Project } from "./helpers.js";
import { runAcceptance } from "../../src/workflow/runner.js";

const PM = resolve(import.meta.dirname, "../../plugin/bin/pm.mjs");
const projects: Project[] = [];
const children: ChildProcess[] = [];
const leaves: number[] = [];
const use = (p: Project): Project => { projects.push(p); return p; };
const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
afterEach(() => {
  vi.unstubAllEnvs();
  children.splice(0).forEach((p) => { if (p.exitCode === null && p.signalCode === null) p.kill("SIGKILL"); });
  leaves.splice(0).forEach((pid) => { try { process.kill(pid, "SIGKILL"); } catch { /* 已被清理 */ } });
  projects.splice(0).forEach((p) => p.cleanup());
});

describe("hook isolation and verification lifetime", () => {
  test("a payload project cannot be redirected to the host project by inherited Claude environment", () => {
    const host = use(smallProject());
    const fixture = use(smallProject());
    host.run(["trust"]);
    fixture.run(["trust"]);
    vi.stubEnv("CLAUDE_PROJECT_DIR", host.root);
    const r = fixture.run(["hook", "session-end", "--sync"], JSON.stringify({ cwd: fixture.root }));
    expect(r.err).toBe("");
    expect(existsSync(join(fixture.root, ".pm/evidence.json"))).toBe(true);
    expect(existsSync(join(host.root, ".pm/evidence.json"))).toBe(false);
  });

  test("an explicit unmanaged payload does not fall back to the host project", () => {
    const host = use(smallProject());
    const fixture = use(makeProject());
    vi.stubEnv("CLAUDE_PROJECT_DIR", host.root);
    expect(fixture.run(["hook", "session-start"], JSON.stringify({ cwd: fixture.root })).out).toBe("");
  });

  test("acceptance children cannot launch verification or hooks for the same project again", () => {
    const p = use(smallProject());
    p.run(["trust"]);
    vi.stubEnv("AI_PM_VERIFY_ROOT", p.root);
    const r = p.run(["verify"]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/不能递归/);
    p.run(["hook", "session-end", "--sync"], JSON.stringify({ cwd: p.root }));
    expect(existsSync(join(p.root, ".pm/evidence.json"))).toBe(false);
  });

  test("acceptance children see an incremented nesting depth", () => {
    const p = use(smallProject());
    p.write("t/pass.sh", "printf %s \"$AI_PM_VERIFY_DEPTH\" > depth\n");
    vi.stubEnv("AI_PM_VERIFY_DEPTH", "1");
    expect(p.run(["verify", "--only", "a"]).code).toBe(0);
    expect(p.read("depth")).toBe("2");
  });

  test("verification nested too deeply is refused for any project", () => {
    const p = use(smallProject());
    p.write("t/pass.sh", "printf x >> executions\n");
    vi.stubEnv("AI_PM_VERIFY_DEPTH", "2");
    expect(p.run(["verify"])).toMatchObject({ code: 1, err: expect.stringMatching(/嵌套/) });
    expect(existsSync(join(p.root, "executions"))).toBe(false);
  });

  test("tests never inherit the host Claude session's project variables", () => {
    expect(Object.keys(process.env).filter((key) => key.startsWith("CLAUDE_"))).toEqual([]);
  });

  test("a shared acceptance file is executed only once per verification", () => {
    const p = use(smallProject());
    p.write("t/pass.sh", "printf x >> executions\n");
    expect(p.run(["verify"]).code).toBe(0);
    expect(p.read("executions")).toBe("x");
    expect(JSON.parse(p.read(".pm/evidence.json"))).toMatchObject({ a: { passed: 1 }, b: { passed: 1 } });
  });

  test("another live verifier is rejected without starting a second test", async () => {
    const p = use(smallProject());
    p.write("t/pass.sh", "printf x >> executions\nsleep 1\n");
    const child = spawn(process.execPath, [PM, "verify", "--only", "a"], { cwd: p.root, stdio: "ignore" });
    children.push(child);
    const exited = once(child, "exit");
    await expect.poll(() => existsSync(join(p.root, "executions"))).toBe(true);
    expect(p.run(["verify", "--only", "a"])).toMatchObject({ code: 1, err: expect.stringMatching(/已有验收任务/) });
    expect(p.read("executions")).toBe("x");
    await exited;
    expect(child.exitCode).toBe(0);
    expect(existsSync(join(p.root, ".pm/.verify.lock"))).toBe(false);
  });

  test("a lock left by an exited verifier can be recovered", () => {
    const p = use(smallProject());
    p.write(".pm/.verify.lock", JSON.stringify({ pid: 99999999, token: "dead-verifier" }));
    expect(p.run(["verify", "--only", "a"]).code).toBe(0);
    expect(existsSync(join(p.root, ".pm/.verify.lock"))).toBe(false);
  });

  test("async session-end launches the PM entry rather than the importing caller", async () => {
    const p = use(smallProject());
    p.run(["trust"]);
    p.write("caller.cjs", "require('node:fs').writeFileSync('wrong-entry', 'restarted');");
    const previous = process.argv[1];
    try {
      process.argv[1] = join(p.root, "caller.cjs");
      expect(p.run(["hook", "session-end"], JSON.stringify({ cwd: p.root })).code).toBe(0);
    } finally { process.argv[1] = previous as string; }
    await expect.poll(() => existsSync(join(p.root, ".pm/last-run.log")), { timeout: 5000 }).toBe(true);
    expect(p.read(".pm/last-run.log")).toMatch(/验收/);
    expect(existsSync(join(p.root, "wrong-entry"))).toBe(false);
  });
});

describe("acceptance process tree cleanup", () => {
  const leaf = (p: Project): string => {
    p.write("leaf.cjs", "require('node:fs').writeFileSync('leaf.pid', String(process.pid)); process.on('SIGTERM', () => {}); setTimeout(() => {}, 8000);");
    return JSON.stringify(process.execPath) + ' "$PM_FILE"';
  };
  const leafPid = (p: Project): number => {
    const pid = Number(readFileSync(join(p.root, "leaf.pid"), "utf8"));
    leaves.push(pid);
    return pid;
  };

  test("timeout kills the shell and its SIGTERM-resistant descendant", async () => {
    const p = use(makeProject());
    const command = leaf(p) + "; exit 0";
    const started = Date.now();
    expect(runAcceptance(p.root, "leaf.cjs", { ".cjs": command }, 0.5)).toMatchObject({ ok: false, warning: expect.stringMatching(/超时/) });
    expect(Date.now() - started).toBeLessThan(3000);
    const pid = leafPid(p);
    await expect.poll(() => alive(pid)).toBe(false);
  });

  test("a successful shell cannot leave its background child behind", async () => {
    const p = use(makeProject());
    const command = leaf(p) + ' & while [ ! -f leaf.pid ]; do sleep 0.01; done';
    expect(runAcceptance(p.root, "leaf.cjs", { ".cjs": command }, 2)).toEqual({ ok: true });
    const pid = leafPid(p);
    await expect.poll(() => alive(pid)).toBe(false);
  });

  test("the supervisor cleans descendants if the verifier itself is killed", async () => {
    const p = use(makeProject());
    const command = leaf(p) + "; exit 0";
    const runner = resolve(import.meta.dirname, "../../src/workflow/runner.ts");
    const source = `import { runAcceptance } from ${JSON.stringify(runner)}; runAcceptance(${JSON.stringify(p.root)}, 'leaf.cjs', { '.cjs': ${JSON.stringify(command)} }, 5);`;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], { cwd: resolve(import.meta.dirname, "../.."), stdio: "ignore" });
    children.push(child);
    const exited = once(child, "exit");
    await expect.poll(() => existsSync(join(p.root, "leaf.pid"))).toBe(true);
    const pid = leafPid(p);
    child.kill("SIGKILL");
    await exited;
    await expect.poll(() => alive(pid)).toBe(false);
  });
});
