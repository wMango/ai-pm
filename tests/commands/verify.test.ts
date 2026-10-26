import { afterEach, describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FAIL, PASS, smallProject } from "./helpers.js";
import type { Project } from "./helpers.js";

let project: Project | null = null;
const use = (p: Project): Project => (project = p);
afterEach(() => project?.cleanup());
const evidenceOf = (p: Project): Record<string, { passed: number; total: number; pendingReview: boolean }> => JSON.parse(p.read(".pm/evidence.json"));

describe("pm verify", () => {
  test("runs every acceptance file and writes evidence", () => {
    const p = use(smallProject());
    const r = p.run(["verify"]);
    expect(r.code).toBe(0);
    const ev = evidenceOf(p);
    expect(ev.a).toMatchObject({ passed: 1, total: 1 });
    expect(ev.b).toMatchObject({ passed: 1, total: 2 });
    expect(ev.f).toMatchObject({ passed: 0, total: 1 });
    expect(r.out).toMatch(/b 组件 B：1\/2/);
  });

  test("unlocked nodes are pending review; locked and unchanged are not", () => {
    const p = use(smallProject());
    p.run(["lock", "a"]);
    p.run(["verify"]);
    const ev = evidenceOf(p);
    expect(ev.a?.pendingReview).toBe(false);
    expect(ev.b?.pendingReview).toBe(true);
  });

  test("editing a locked test marks the node pending review", () => {
    const p = use(smallProject());
    p.run(["lock", "f"], "", ["y"]);
    p.write("t/f.sh", PASS);
    p.run(["verify"]);
    expect(evidenceOf(p).f).toMatchObject({ passed: 1, total: 1, pendingReview: true });
  });

  test("editing the locked spec also marks the node pending review", () => {
    const p = use(smallProject());
    p.run(["lock", "f"], "", ["y"]);
    p.write(".pm/acceptance/f.feature", "Feature: weaker\n");
    p.run(["verify"]);
    expect(evidenceOf(p).f?.pendingReview).toBe(true);
  });

  test("--only re-runs some nodes and keeps the rest", () => {
    const p = use(smallProject());
    p.run(["verify"]);
    p.write("t/fail.sh", PASS);
    p.run(["verify", "--only", "b"]);
    const ev = evidenceOf(p);
    expect(ev.b).toMatchObject({ passed: 2, total: 2 });
    expect(ev.f).toMatchObject({ passed: 0, total: 1 });
  });

  test("files without a runner or missing files count as not passed, with a warning", () => {
    const p = use(smallProject());
    p.write(".pm/pm.yaml", p.read(".pm/pm.yaml").replace("[t/pass.sh, t/fail.sh]", "[t/check.py, t/gone.sh]"));
    p.write("t/check.py", "print(1)\n");
    const r = p.run(["verify"]);
    expect(evidenceOf(p).b).toMatchObject({ passed: 0, total: 2 });
    expect(r.err).toMatch(/没有为 \.py 配置运行器/);
    expect(r.err).toMatch(/t\/gone\.sh 不存在/);
  });

  test("a test that runs past the timeout fails", () => {
    const p = use(smallProject());
    p.write("t/pass.sh", "sleep 5\n");
    const r = p.run(["verify", "--only", "a"]);
    expect(evidenceOf(p).a).toMatchObject({ passed: 0, total: 1 });
    expect(r.err).toMatch(/超时/);
  }, 10000);

  test("file paths are quoted, so names cannot inject shell commands", () => {
    const p = use(smallProject());
    const tricky = "t/it's $(touch pwned).sh";
    p.write(".pm/pm.yaml", p.read(".pm/pm.yaml").replace("[t/pass.sh], depends", `["${tricky}"], depends`));
    p.write(tricky, PASS);
    p.run(["verify", "--only", "a"]);
    expect(evidenceOf(p).a).toMatchObject({ passed: 1, total: 1 });
    expect(existsSync(join(p.root, "pwned"))).toBe(false);
  });

  test("rejects acceptance paths that escape the project", () => {
    const p = use(smallProject());
    p.write(".pm/pm.yaml", p.read(".pm/pm.yaml").replace("[t/pass.sh], depends", "[../outside.sh], depends"));
    const r = p.run(["verify"]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/项目内的相对路径/);
  });

  test("uses the most specific runner suffix", () => {
    const p = use(smallProject());
    p.write(".pm/pm.yaml", p.read(".pm/pm.yaml")
      .replace('runners: { ".sh": "sh {file}" }', 'runners: { ".sh": "false {file}", ".ok.sh": "sh {file}" }')
      .replace("[t/pass.sh], depends", "[t/x.ok.sh], depends"));
    p.write("t/x.ok.sh", PASS);
    p.run(["verify", "--only", "a"]);
    expect(evidenceOf(p).a).toMatchObject({ passed: 1, total: 1 });
  });

  test("a node with only a spec is in progress, not todo", () => {
    const p = use(smallProject());
    p.write(".pm/pm.yaml", p.read(".pm/pm.yaml").replace("spec: .pm/acceptance/f.feature, acceptance: [t/f.sh]", "spec: .pm/acceptance/f.feature"));
    p.run(["verify"]);
    p.run(["dashboard"]);
    expect(p.read(".pm/dashboard.html")).toMatch(/"id":"f","name":"功能 F","view":"functional","status":"doing"/);
    expect(FAIL).toBe("exit 1\n");
  });
});
