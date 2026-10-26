import { afterEach, describe, expect, test } from "vitest";
import { Window } from "happy-dom";
import { analyze, renderDashboard } from "../src/index.js";
import type { Analysis } from "../src/index.js";
import { DEMO_NOW, loadDemo } from "./helpers.js";

// 在无头 DOM 里真正执行页面脚本，确认五个视图都能渲染、交互可用
let window: Window | null = null;

const open = async (analysis: Analysis): Promise<Window["document"]> => {
  window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  window.document.write(renderDashboard(analysis));
  await window.happyDOM.waitUntilComplete();
  return window.document;
};

const demo = (): Analysis => {
  const { model, evidence, ledger } = loadDemo();
  return analyze(model, { evidence, ledger, now: DEMO_NOW });
};

afterEach(async () => {
  await window?.happyDOM.close();
  window = null;
});

type HappyElement = ReturnType<Window["document"]["querySelector"]>;

const click = (target: HappyElement): void => {
  if (!target || !window) throw new Error("要点击的元素不存在");
  target.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
};

describe("dashboard page", () => {
  test("renders every view without errors", async () => {
    const doc = await open(demo());
    expect(doc.querySelectorAll(".render-error")).toHaveLength(0);
    expect(doc.querySelector("#metrics")?.textContent).toMatch(/23/);
    expect(doc.querySelectorAll("#map-svg g.node")).toHaveLength(13);
    expect(doc.querySelectorAll("#goals .goal-card")).toHaveLength(3);
    expect(doc.querySelectorAll("#recs .rec-row").length).toBeGreaterThanOrEqual(5);
    expect(doc.querySelectorAll("#cost-svg circle.bubble")).toHaveLength(3);
    expect(doc.querySelectorAll("#blueprints g.bp-step")).toHaveLength(4);
  });

  test("switches between the three architecture views", async () => {
    const doc = await open(demo());
    click(doc.querySelector('button[data-view="physical"]'));
    expect(doc.querySelectorAll("#map-svg g.node")).toHaveLength(5);
    click(doc.querySelector('button[data-view="functional"]'));
    expect(doc.querySelectorAll("#map-svg g.node")).toHaveLength(5);
  });

  test("built view hides blockage, effective view reveals it", async () => {
    const doc = await open(demo());
    const stateOf = (): string | null | undefined => doc.querySelector('#map-svg g.node[data-id="chatui"]')?.getAttribute("data-state");
    expect(stateOf()).toBe("blocked");
    click(doc.querySelector('button[data-mode="built"]'));
    expect(stateOf()).toBe("ok");
  });

  test("clicking a node explains its root blockers", async () => {
    const doc = await open(demo());
    click(doc.querySelector('#map-svg g.node[data-id="chatui"]'));
    const panel = doc.querySelector("#panel")?.textContent ?? "";
    expect(panel).toContain("对话界面");
    expect(panel).toContain("向量检索");
    expect(panel).toContain("PG 向量实例");
  });

  test("keeps keyboard focus on the node after selecting it", async () => {
    const doc = await open(demo());
    const node = doc.querySelector('#map-svg g.node[data-id="chatui"]') as unknown as { focus: () => void; dispatchEvent: (e: unknown) => void };
    node.focus();
    node.dispatchEvent(new (window as Window).KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(doc.activeElement?.getAttribute("data-id")).toBe("chatui");
    expect(doc.querySelector("#panel")?.textContent).toContain("对话界面");
  });

  test("treats user-provided names as text, never as markup", async () => {
    const analysis = demo();
    const evil = '<img src=x onerror="window.__pwned=1">';
    const tampered = { ...analysis, project: evil, nodes: analysis.nodes.map((n) => (n.id === "chatui" ? { ...n, name: evil } : n)) };
    const doc = await open(tampered);
    expect(doc.querySelectorAll("img")).toHaveLength(0);
    expect(doc.querySelector("h1")?.textContent).toContain(evil);
  });

  test("shows friendly empty states for a brand-new project", async () => {
    const { model } = loadDemo();
    const fresh = analyze({ ...model, goals: [] }, { evidence: {}, ledger: [], now: DEMO_NOW });
    const doc = await open(fresh);
    expect(doc.querySelectorAll(".render-error")).toHaveLength(0);
    expect(doc.querySelector("#goals")?.textContent).toMatch(/还没有目标/);
    expect(doc.querySelector("#cost-section")?.textContent).toMatch(/还没有成本记录/);
    expect(doc.querySelector("#blueprints")?.textContent).toMatch(/还没有旅程/);
  });
});
