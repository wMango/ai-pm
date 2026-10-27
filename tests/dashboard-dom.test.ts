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

// 拥挤场景：服务层再塞 20 个已生效、4 个被卡住的模块
const CROWD_IDS = {
  healthy: Array.from({ length: 20 }, (_, i) => `svc${i}`),
  blocked: Array.from({ length: 4 }, (_, i) => `stuck${i}`),
};
const crowded = (): Analysis => {
  const { model, evidence, ledger } = loadDemo();
  const service = (id: string, on: string) => ({ id, name: `服务模块 ${id}`, layer: "service" as const, acceptance: [`t/${id}.test.ts`], depends: [{ on, kind: "hard" as const }] });
  const extra = [...CROWD_IDS.healthy.map((id) => service(id, "userdb")), ...CROWD_IDS.blocked.map((id) => service(id, "retr"))];
  const passing = Object.fromEntries(extra.map((n) => [n.id, { passed: 1, total: 1, pendingReview: false }]));
  const logical = [...model.views.logical, ...extra];
  return analyze({ ...model, views: { ...model.views, logical } }, { evidence: { ...evidence, ...passing }, ledger, now: DEMO_NOW });
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

  test("wraps a crowded layer onto several lines instead of shrinking it", async () => {
    const doc = await open(crowded());
    const width = Number(doc.querySelector("#map-svg")?.getAttribute("viewBox")?.split(" ")[2]);
    expect(width).toBeLessThanOrEqual(1000);
    const serviceYs = new Set(CROWD_IDS.blocked.map((id) => doc.querySelector(`#map-svg g.node[data-id="${id}"]`)?.getAttribute("transform")?.split(",")[1]));
    expect(serviceYs.size).toBeGreaterThan(1);
  });

  test("folds healthy modules of a crowded layer and expands them on demand", async () => {
    const doc = await open(crowded());
    const nodes = (): number => doc.querySelectorAll("#map-svg g.node[data-id]").length;
    const fold = (): HappyElement => doc.querySelector("#map-svg g.fold[data-fold]");
    const all = 13 + CROWD_IDS.blocked.length + CROWD_IDS.healthy.length;
    const folded = Number(fold()?.querySelector("text")?.textContent?.match(/^(\d+) 个已生效/)?.[1]);
    expect(folded).toBeGreaterThanOrEqual(CROWD_IDS.healthy.length);
    expect(nodes()).toBe(all - folded);
    CROWD_IDS.blocked.forEach((id) => expect(doc.querySelector(`#map-svg g.node[data-id="${id}"]`)).not.toBeNull());
    click(fold());
    expect(nodes()).toBe(all);
    expect(fold()?.querySelector("text")?.textContent).toMatch(/收起/);
    click(fold());
    expect(nodes()).toBe(all - folded);
  });

  test("keeps a folded module visible once it is selected from elsewhere", async () => {
    const doc = await open(crowded());
    click(doc.querySelector('#map-svg g.node[data-id="userdb"]'));
    click(doc.querySelector('#panel [data-jump="svc0"]'));
    expect(doc.querySelector('#map-svg g.node[data-id="svc0"]')).not.toBeNull();
  });

  test("thins out edges on a dense map and can show them all", async () => {
    const doc = await open(crowded());
    click(doc.querySelector("#map-svg g.fold[data-fold]"));
    const hint = doc.querySelector("#map-hint");
    expect(hint?.hasAttribute("hidden")).toBe(false);
    const thin = doc.querySelectorAll("#map-svg path[marker-end]").length;
    click(doc.querySelector("#map-hint button"));
    expect(doc.querySelectorAll("#map-svg path[marker-end]").length).toBeGreaterThan(thin);
  });

  test("collapses long chip lists behind a counter", async () => {
    const doc = await open(crowded());
    click(doc.querySelector('#map-svg g.node[data-id="userdb"]'));
    const more = doc.querySelector("#panel details.more summary");
    expect(more?.textContent).toMatch(/^\+\d+/);
  });

  test("caps a crowded blueprint lane and keeps the root cause visible", async () => {
    const { model, evidence, ledger } = loadDemo();
    const extra = CROWD_IDS.healthy.slice(0, 8).map((id) => ({ id, name: `服务模块 ${id}`, layer: "service" as const, acceptance: [], depends: [] }));
    const mappings = [...model.mappings, { from: "f-ask", to: extra.map((n) => n.id), kind: "realized_by" as const, require: "all" as const }];
    const analysis = analyze({ ...model, mappings, views: { ...model.views, logical: [...model.views.logical, ...extra] } }, { evidence, ledger, now: DEMO_NOW });
    const doc = await open(analysis);
    const overflow = [...doc.querySelectorAll("#blueprints g[role=img]")].map((g) => g.getAttribute("aria-label") ?? "");
    expect(overflow.some((label) => /^另有 \d+ 个模块/.test(label))).toBe(true);
    doc.querySelectorAll("#blueprints g.bp-step").forEach((step) => {
      const lanes = step.querySelectorAll("g.node[data-jump]").length;
      expect(lanes).toBeLessThanOrEqual(3 * 4);
    });
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
