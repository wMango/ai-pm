import { afterEach, describe, expect, test } from "vitest";
import { PASS, makeProject, smallProject } from "../commands/helpers.js";
import type { Project } from "../commands/helpers.js";

let project: Project | null = null;
afterEach(() => {
  project?.cleanup();
  project = null;
});

const payload = (dir: string): string => JSON.stringify({ session_id: "s1", workspace: { current_dir: dir, project_dir: dir } });

describe("pm statusline", () => {
  test("prints one line with effectiveness, current module and the next step", () => {
    project = smallProject();
    project.run(["start", "a"]);
    const run = project.run(["statusline"], payload(project.root));
    expect(run.code).toBe(0);
    const line = run.out.trimEnd();
    expect(line.split("\n")).toHaveLength(1);
    expect(line).toContain("小项目");
    expect(line).toMatch(/生效 0\/3/);
    expect(line).toContain("当前 组件 A");
    expect(line).toMatch(/下一步 /);
    expect(line).toMatch(/待复核 \d+/);
  });

  test("finds the project from the payload even when run elsewhere", () => {
    project = smallProject();
    const elsewhere = makeProject();
    try {
      const run = elsewhere.run(["statusline"], payload(project.root));
      expect(run.out).toContain("小项目");
    } finally {
      elsewhere.cleanup();
    }
  });

  test("falls back to the working directory when the payload is not JSON", () => {
    project = smallProject();
    expect(project.run(["statusline"], "not json").out).toContain("小项目");
  });

  test("strips control characters and long names from the line", () => {
    project = smallProject();
    const evil = `${"很长的名字".repeat(10)}\u001b[2J\nsecond line`;
    project.write(".pm/pm.yaml", project.read(".pm/pm.yaml").replace("name: 组件 A", `name: ${JSON.stringify(evil)}`));
    project.run(["start", "a"]);
    const line = project.run(["statusline"], payload(project.root)).out;
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trimEnd()).not.toMatch(/[\u0000-\u001f\u007f]/);
    expect(line).toContain("…");
  });

  test("stays silent outside a managed project or when pm.yaml is broken", () => {
    project = makeProject();
    expect(project.run(["statusline"], payload(project.root))).toEqual({ code: 0, out: "", err: "" });
    project.write(".pm/pm.yaml", "version: 1\nviews: [oops\n");
    expect(project.run(["statusline"], payload(project.root))).toEqual({ code: 0, out: "", err: "" });
  });

  test("shows the effective count once modules pass", () => {
    project = smallProject();
    project.write("t/f.sh", PASS);
    project.write("t/fail.sh", PASS);
    project.run(["verify"]);
    expect(project.run(["statusline"], payload(project.root)).out).toMatch(/生效 3\/3/);
  });
});

describe("pm setup statusline", () => {
  test("writes the status line into the project's local Claude settings", () => {
    project = smallProject();
    project.write(".claude/settings.local.json", JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }));
    const run = project.run(["setup", "statusline"]);
    expect(run.code).toBe(0);
    const settings = JSON.parse(project.read(".claude/settings.local.json"));
    expect(settings.permissions).toEqual({ allow: ["Bash(ls)"] });
    expect(settings.statusLine.type).toBe("command");
    expect(settings.statusLine.command).toMatch(/pm\.mjs" statusline$/);
  });

  test("never overwrites a status line the user already has", () => {
    project = smallProject();
    const mine = { statusLine: { type: "command", command: "my-line" } };
    project.write(".claude/settings.local.json", JSON.stringify(mine));
    const run = project.run(["setup", "statusline"]);
    expect(run.code).toBe(1);
    expect(run.err).toMatch(/已经配置了状态栏/);
    expect(JSON.parse(project.read(".claude/settings.local.json"))).toEqual(mine);
  });
});
