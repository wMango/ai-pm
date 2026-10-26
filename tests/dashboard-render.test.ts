import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { analyze, renderDashboard, serializeForScript } from "../src/index.js";
import type { Analysis } from "../src/index.js";
import { DEMO_NOW, loadDemo } from "./helpers.js";

const demoAnalysis = (): Analysis => {
  const { model, evidence, ledger } = loadDemo();
  return analyze(model, { evidence, ledger, now: DEMO_NOW });
};

const embeddedData = (html: string): unknown => {
  const match = html.match(/<script type="application\/json" id="pm-data">([\s\S]*?)<\/script>/);
  if (!match?.[1]) throw new Error("没有找到内嵌数据");
  return JSON.parse(match[1]);
};

describe("renderDashboard", () => {
  test("produces a complete single-file HTML document", () => {
    const html = renderDashboard(demoAnalysis());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>智能知识库问答平台 · 项目地图</title>");
    expect(html).toContain("<style>");
    expect(html).toMatch(/<script>\s*\(\(\) => \{/);
  });

  test("embeds the analysis so the page can render without a server", () => {
    const analysis = demoAnalysis();
    const data = embeddedData(renderDashboard(analysis)) as Analysis & { cost: { nodes: Record<string, unknown> } };
    expect(data.nodes).toHaveLength(23);
    expect(data.cost.nodes.kb).toEqual({ tokens: 610000, days: 6 });
    expect(data.recommendations[0]?.target).toBe(analysis.recommendations[0]?.target);
  });

  test("works offline: no external scripts, styles or fonts", () => {
    const html = renderDashboard(demoAnalysis());
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/@import/);
  });

  test("escapes user-controlled names in the title and the embedded JSON", () => {
    const evil = "</script><script>alert(1)</script>";
    const analysis = { ...demoAnalysis(), project: evil };
    const html = renderDashboard(analysis);
    expect(html).not.toContain(evil);
    expect(html).toContain("<title>&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; · 项目地图</title>");
    expect((embeddedData(html) as Analysis).project).toBe(evil);
  });

  test("escapes JavaScript line separators that would break inline scripts", () => {
    const raw = serializeForScript({ name: "a\u2028b\u2029c<" });
    expect(raw).toBe('{"name":"a\\u2028b\\u2029c\\u003c"}');
    expect(JSON.parse(raw)).toEqual({ name: "a\u2028b\u2029c<" });
  });

  test("locks the page down with a hash-based Content-Security-Policy", () => {
    const html = renderDashboard(demoAnalysis());
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    const hash = createHash("sha256").update(script).digest("base64");
    const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain(`script-src 'sha256-${hash}'`);
  });
});
