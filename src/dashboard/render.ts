import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Analysis } from "../analyze.js";

/** 浏览器端脚本，按顺序拼进同一个闭包；后面的文件可以使用前面定义的函数 */
const CLIENT_FILES = ["util.js", "map.js", "blockers.js", "goals.js", "cost.js", "blueprint.js", "main.js"] as const;
const CLIENT_DIR = new URL("./client/", import.meta.url);

const readClient = (name: string): string => readFileSync(new URL(name, CLIENT_DIR), "utf8");

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);

/** 安全地把数据放进 <script>：转义 <，避免 </script> 提前闭合；转义行分隔符 */
const LINE_SEPARATORS = new RegExp("[\\u2028\\u2029]", "g");
export const serializeForScript = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(LINE_SEPARATORS, (c) => (c === "\u2028" ? "\\u2028" : "\\u2029"));

/** Map 不能直接 JSON 化，转成普通对象供页面使用 */
export const toPlainData = (analysis: Analysis): Omit<Analysis, "cost"> & { cost: Omit<Analysis["cost"], "nodes"> & { nodes: Record<string, { tokens: number; days: number }> } } => ({
  ...analysis,
  cost: { ...analysis.cost, nodes: Object.fromEntries(analysis.cost.nodes) },
});

const SECTIONS = `
<header class="top">
  <div>
    <div class="eyebrow">项目地图 · 由 pm.yaml 生成</div>
    <h1 id="project-name"></h1>
    <p class="sub" id="generated-at"></p>
  </div>
  <div id="metrics" class="metrics"></div>
</header>
<div id="warnings"></div>
<nav class="jump" aria-label="视图导航">
  <a href="#map-section">① 架构地图</a><a href="#blockers-section">② 依赖与阻塞</a><a href="#goals-section">③ 目标与下一步</a><a href="#cost-section">④ 成本</a><a href="#blueprint-section">⑤ 旅程蓝图</a>
</nav>
<section id="map-section">
  <h2>① 架构地图</h2>
  <p class="sub">切换三套架构；"生效视角"会暴露被卡住的模块。点击模块查看依赖、映射与根因。</p>
  <div class="map-wrap">
    <div class="card map-card">
      <div class="toolbar">
        <div class="seg" role="group" aria-label="架构视图">
          <button type="button" data-view="functional">功能</button><button type="button" data-view="logical">逻辑</button><button type="button" data-view="physical">物理</button>
        </div>
        <div class="seg" role="group" aria-label="视角">
          <button type="button" data-mode="built">建成视角</button><button type="button" data-mode="effective">生效视角</button>
        </div>
        <div class="legend" id="legend"></div>
      </div>
      <div class="scroll-x"><svg id="map-svg" role="img" aria-label="架构地图"></svg></div>
    </div>
    <aside class="card panel" id="panel" aria-live="polite"></aside>
  </div>
</section>
<section id="blockers-section">
  <h2>② 依赖与阻塞</h2>
  <p class="sub">哪些未完成的模块卡住了最多已经写好的模块。</p>
  <div class="card pad" id="blockers"></div>
</section>
<section id="goals-section">
  <h2>③ 目标与下一步</h2>
  <p class="sub">每个目标还差什么；按杠杆排序的下一步，以及做完之后目标会怎样变化。</p>
  <div class="goals" id="goals"></div>
  <div class="recs-wrap"><div class="card pad" id="recs"></div><div class="card pad whatif" id="whatif"></div></div>
</section>
<section id="cost-section">
  <h2>④ 成本</h2>
  <p class="sub">只展示投入，不计入进度。气泡 = 模块，横轴天数，纵轴 token，颜色是生效状态。</p>
  <div class="cost-wrap" id="cost-body"><div class="card pad scroll-x"><svg id="cost-svg" role="img" aria-label="成本气泡图"></svg></div><aside class="card pad" id="cost-side"></aside></div>
</section>
<section id="blueprint-section">
  <h2>⑤ 旅程蓝图</h2>
  <p class="sub">横向是用户旅程，纵向泳道对应三套架构；红线表示从可见线以下断掉的地方。</p>
  <div id="blueprints"></div>
</section>
<footer>本页离线可用 · 由 ai-pm-engine 生成</footer>`;

/** 生成单文件、离线可打开的项目地图页面 */
/** 只允许本页这一段脚本执行；数据块是 application/json，不会被执行 */
const contentSecurityPolicy = (script: string): string => {
  const hash = createHash("sha256").update(script).digest("base64");
  return `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'`;
};

export const renderDashboard = (analysis: Analysis): string => {
  const client = CLIENT_FILES.map(readClient).join("\n");
  const script = `\n(() => {\n"use strict";\n${client}\n})();\n`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(script)}">
<title>${escapeHtml(analysis.project)} · 项目地图</title>
<style>
${readClient("dashboard.css")}
</style>
</head>
<body>
<main>${SECTIONS}
</main>
<script type="application/json" id="pm-data">${serializeForScript(toPlainData(analysis))}</script>
<script>${script}</script>
</body>
</html>
`;
};
