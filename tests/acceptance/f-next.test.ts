// f-next 验收：端到端用户流程，对应 .pm/acceptance/f-next.feature
// 在临时项目里用真实的插件产物 plugin/bin/pm.mjs 运行 verify → context / dashboard
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Window } from "happy-dom";
import { afterEach, describe, expect, test } from "vitest";

const PM = resolve(import.meta.dirname, "../../plugin/bin/pm.mjs");
const PASS = "exit 0\n";
const FAIL = "exit 1\n";

const roots: string[] = [];
let window: Window | null = null;

afterEach(async () => {
  await window?.happyDOM.close();
  window = null;
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

const makeProject = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "f-next-acceptance-"));
  roots.push(root);
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  Object.entries(files).forEach(([path, content]) => write(path, content));
  const pm = (...args: string[]): string => {
    const result = spawnSync("node", [PM, ...args], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`pm ${args.join(" ")} 失败：${result.stderr}`);
    return result.stdout;
  };
  return { root, write, pm };
};

// G1：甲（已生效）→ 乙（未通过）            进度 1/2 = 50%
// G2：丙（已通过）依赖 丁（未建）            丙被卡住，进度 0%
// G3：戊、己、庚、辛 四个都未建              进度 0%
// 杠杆：丁（G2 +100）> 乙（G1 +50）> 戊己庚辛（G3 各 +25）
const GAP_PROJECT = {
  ".pm/pm.yaml": `version: 1
project: 验收样例
views:
  functional:
    - { id: fa, name: 甲, acceptance: [t/pass.sh] }
    - { id: fb, name: 乙, acceptance: [t/fail.sh], depends: [{ on: fa }] }
    - { id: fc, name: 丙, acceptance: [t/pass.sh], depends: [{ on: fd }] }
    - { id: fd, name: 丁 }
    - { id: fe, name: 戊 }
    - { id: ff, name: 己 }
    - { id: fg, name: 庚 }
    - { id: fh, name: 辛 }
goals:
  - { id: G1, name: 目标一, requires: [fb] }
  - { id: G2, name: 目标二, requires: [fc] }
  - { id: G3, name: 目标三, requires: [fe, ff, fg, fh] }
`,
  "t/pass.sh": PASS,
  "t/fail.sh": FAIL,
};

const contextLines = (pm: (...args: string[]) => string): string[] => {
  pm("verify");
  return pm("context").split("\n");
};

describe("f-next 验收", () => {
  test("看到每个目标的进度和缺口；被卡住的模块不让进度上涨", () => {
    const { pm } = makeProject(GAP_PROJECT);
    const lines = contextLines(pm);
    expect(lines).toContain("- G1 目标一：50%，还要建 乙（fb）");
    expect(lines).toContain("- G2 目标二：0%，还要建 丁（fd）");
    expect(lines).toContain("- G3 目标三：0%，还要建 戊（fe）、己（ff）、庚（fg）、辛（fh）");
  });

  test("下一步按杠杆排序，最多 3 条，并说明做完后的变化", () => {
    const { pm } = makeProject(GAP_PROJECT);
    const lines = contextLines(pm);
    const start = lines.indexOf("- 下一步（按杠杆）：");
    expect(start).toBeGreaterThan(-1);
    const recs = lines.slice(start + 1).filter((line) => /^ {2}\d+\. /.test(line));
    expect(recs).toEqual([
      "  1. 丁（fd）：要做 丁（fd）；G2 0% → 100%",
      "  2. 乙（fb）：要做 乙（fb）；G1 50% → 100%",
      "  3. 戊（fe）：要做 戊（fe）；G3 0% → 25%",
    ]);
  });

  test("没有可推进的事时明确告诉我", () => {
    const { pm } = makeProject({
      ".pm/pm.yaml": `version: 1
project: 已完成的项目
views:
  functional:
    - { id: fa, name: 甲, acceptance: [t/pass.sh] }
goals:
  - { id: G1, name: 目标一, requires: [fa] }
`,
      "t/pass.sh": PASS,
    });
    const lines = contextLines(pm);
    expect(lines).toContain("- G1 目标一：100%");
    expect(lines).toContain("- 下一步：暂无可推进目标的推荐");
  });

  test("锁定后验收测试被改动，提醒待复核", () => {
    const { pm, write } = makeProject({
      ".pm/pm.yaml": `version: 1
project: 复核样例
views:
  physical:
    - { id: p1, name: 服务器, acceptance: [t/p1.sh] }
goals:
  - { id: G1, name: 目标一, requires: [p1] }
`,
      "t/p1.sh": PASS,
    });
    pm("lock", "p1");
    expect(contextLines(pm).some((line) => line.includes("待复核"))).toBe(false);
    write("t/p1.sh", `# 改过了\n${PASS}`);
    expect(contextLines(pm)).toContain("- 待复核：服务器（p1）（验收条目或测试未锁定或被改动）");
  });

  test("地图页面的「目标」视图里看到同样的缺口和推荐", async () => {
    const { pm, root } = makeProject(GAP_PROJECT);
    const contextRecs = contextLines(pm).filter((line) => /^ {2}\d+\. /.test(line)).map((line) => line.replace(/^ {2}\d+\. (\S+?)（.*$/, "$1"));
    pm("dashboard", "--static");

    window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
    window.document.write(readFileSync(join(root, ".pm/dashboard.html"), "utf8"));
    await window.happyDOM.waitUntilComplete();
    const doc = window.document;

    const cards = [...doc.querySelectorAll("#goals .goal-card")].map((card) => card.textContent ?? "");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toContain("G1 · 1/2 生效");
    expect(cards[0]).toMatch(/还要建.*乙/);
    expect(cards[1]).toContain("G2 · 0/2 生效");
    expect(cards[1]).toMatch(/还要建.*丁.*已建但被卡住.*丙/);

    const rows = [...doc.querySelectorAll("#recs .rec-row")].map((row) => row.textContent ?? "");
    expect(rows.slice(0, 3).map((row) => row.replace(/^\d+\. (\S+?)(\+|$)[\s\S]*/, "$1").trim())).toEqual(contextRecs);
    expect(rows[0]).toContain("G2 0% → 100%");
    expect(rows[1]).toContain("G1 50% → 100%");
  });
});
