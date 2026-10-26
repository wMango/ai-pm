import { afterEach, describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPmYaml } from "../../src/index.js";
import { makeProject, smallProject } from "./helpers.js";
import type { Project } from "./helpers.js";

let project: Project | null = null;
const use = (p: Project): Project => (project = p);
afterEach(() => project?.cleanup());

describe("pm init", () => {
  test("creates a valid .pm skeleton", () => {
    const p = use(makeProject());
    const r = p.run(["init", "--project", "新项目"]);
    expect(r.code).toBe(0);
    const loaded = loadPmYaml(p.read(".pm/pm.yaml"));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.model.project).toBe("新项目");
    expect(existsSync(join(p.root, ".pm/acceptance"))).toBe(true);
    expect(p.read(".pm/ledger.jsonl")).toBe("");
    expect(r.out).toMatch(/已初始化 \.pm\//);
  });

  test("defaults the project name to the folder name", () => {
    const p = use(makeProject());
    p.run(["init"]);
    expect(p.read(".pm/pm.yaml")).toMatch(/project: "pm-cmd-/);
  });

  test("never overwrites an existing pm.yaml", () => {
    const p = use(makeProject({ ".pm/pm.yaml": "keep me" }));
    const r = p.run(["init"]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/已经存在/);
    expect(p.read(".pm/pm.yaml")).toBe("keep me");
  });
});

describe("pm start", () => {
  test("records the current module", () => {
    const p = use(smallProject());
    const r = p.run(["start", "a"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(p.read(".pm/current.json"))).toMatchObject({ node: "a" });
    expect(r.out).toMatch(/开工：组件 A/);
  });

  test("reminds to draft acceptance items when the node has no spec", () => {
    const p = use(smallProject());
    expect(p.run(["start", "a"]).out).toMatch(/还没有验收条目.*\.pm\/acceptance\/a\.feature/);
  });

  test("reminds that functional items need human confirmation", () => {
    const p = use(smallProject());
    expect(p.run(["start", "f"]).out).toMatch(/功能层.*人逐条确认/);
  });

  test("rejects unknown nodes", () => {
    const p = use(smallProject());
    const r = p.run(["start", "zzz"]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/找不到节点 zzz/);
  });
});

describe("pm lock", () => {
  test("the AI cannot lock functional nodes: no terminal, no lock", () => {
    const p = use(smallProject());
    for (const args of [["lock", "f"], ["lock", "f", "--by", "human"]]) {
      const r = p.run(args, "y\n");
      expect(r.code).toBe(1);
      expect(r.err).toMatch(/必须由人在终端里/);
      expect(r.err).toMatch(/lock f/);
    }
    expect(existsSync(join(p.root, ".pm/locks.json"))).toBe(false);
  });

  test("a human in the terminal sees the spec and confirms with y", () => {
    const p = use(smallProject());
    const r = p.run(["lock", "f"], "", ["y"]);
    expect(r.code).toBe(0);
    expect(p.prompts.join()).toMatch(/Scenario: works/);
    expect(p.prompts.join()).toMatch(/t\/f\.sh/);
    expect(JSON.parse(p.read(".pm/locks.json")).f).toMatchObject({ by: "human", confirmedVia: "terminal" });
  });

  test("anything but y cancels", () => {
    const p = use(smallProject());
    for (const answer of ["n", "", "yes please"]) {
      const r = p.run(["lock", "f"], "", [answer]);
      expect(r.code).toBe(1);
      expect(r.err).toMatch(/已取消/);
    }
    expect(existsSync(join(p.root, ".pm/locks.json"))).toBe(false);
  });

  test("a mixed lock is all-or-nothing when no human is present", () => {
    const p = use(smallProject());
    expect(p.run(["lock", "a", "f"]).code).toBe(1);
    expect(existsSync(join(p.root, ".pm/locks.json"))).toBe(false);
  });

  test("--by human on a logical node also needs the terminal", () => {
    const p = use(smallProject());
    expect(p.run(["lock", "a", "--by", "human"]).code).toBe(1);
    expect(p.run(["lock", "a"]).code).toBe(0);
  });

  test("stores a fingerprint for the spec and every acceptance file", () => {
    const p = use(smallProject());
    expect(p.run(["lock", "b"]).code).toBe(0);
    const locks = JSON.parse(p.read(".pm/locks.json"));
    expect(Object.keys(locks.b.files)).toEqual(["t/pass.sh", "t/fail.sh"]);
    expect(locks.b.by).toBe("ai");
    expect(locks.b.files["t/pass.sh"]).toMatch(/^[0-9a-f]{64}$/);
  });

  test("refuses to lock missing files", () => {
    const p = use(smallProject());
    p.write(".pm/pm.yaml", p.read(".pm/pm.yaml").replace("[t/pass.sh], depends", "[t/nope.sh], depends"));
    const r = p.run(["lock", "a"]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/t\/nope\.sh 不存在/);
  });
});
