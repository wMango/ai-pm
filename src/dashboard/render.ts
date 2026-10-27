import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Analysis } from "../analyze.js";

/** 浏览器端脚本，按顺序拼进同一个闭包；后面的文件可以使用前面定义的函数 */
const DASHBOARD_CLIENT = ["util.js", "map.js", "blockers.js", "goals.js", "cost.js", "blueprint.js", "live.js", "main.js"] as const;
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

/** 页面之间的导航：历史页里的地图要能回到目录，当前地图要能进入历史 */
export interface PageLinks {
  crumb?: { href: string; label: string; title: string; detail: string };
  history?: string;
  /** pm serve 提供的页面：数据版本号；页面据此订阅更新 */
  live?: string;
  /** 不跑服务器的实时：同目录数据脚本的文件名与当前版本；页面定时重新加载它 */
  liveFile?: LiveFile;
}

export interface LiveFile {
  file: string;
  version: string;
}

/** 数据版本号：不含生成时间，内容没变时版本不变，页面不会白白重绘 */
export const dataVersion = (data: { generatedAt?: unknown }): string =>
  createHash("sha256").update(JSON.stringify({ ...data, generatedAt: null })).digest("hex").slice(0, 12);

/** 同目录数据脚本的内容：调用页面注册的 window.__pmLive */
export const liveDataScript = (version: string, data: unknown): string =>
  `window.__pmLive && window.__pmLive(${JSON.stringify(version)}, ${serializeForScript(data)});\n`;

const crumbHtml = (crumb: PageLinks["crumb"]): string => (crumb
  ? `<nav class="crumb" aria-label="位置"><a href="${escapeHtml(crumb.href)}">${escapeHtml(crumb.label)}</a><span><b>${escapeHtml(crumb.title)}</b>${escapeHtml(crumb.detail)}</span></nav>`
  : "");

const historyLink = (href: string | undefined): string => (href ? `<a class="out" href="${escapeHtml(href)}">⑥ 历史</a>` : "");

const dashboardSections = (links: PageLinks): string => `${crumbHtml(links.crumb)}
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
  <a href="#map-section">① 架构地图</a><a href="#blockers-section">② 依赖与阻塞</a><a href="#goals-section">③ 目标与下一步</a><a href="#cost-section">④ 成本</a><a href="#blueprint-section">⑤ 旅程蓝图</a>${historyLink(links.history)}
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
      <p class="map-hint" id="map-hint" hidden></p>
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

/** 只允许本页这一段脚本执行；数据块是 application/json，不会被执行 */
/**
 * 只允许本页这一段内嵌脚本执行。两种实时模式各多开放一项：
 * pm serve 的页面要连回同源服务（connect-src 'self'）；本地文件页要加载同目录的数据脚本（script-src 'self'）
 */
const contentSecurityPolicy = (script: string, live: boolean, liveFile: boolean): string => {
  const hash = createHash("sha256").update(script).digest("base64");
  return `default-src 'none'; script-src 'sha256-${hash}'${liveFile ? " 'self'" : ""}; style-src 'unsafe-inline'; img-src data:;${live ? " connect-src 'self';" : ""} base-uri 'none'; form-action 'none'`;
};

export interface PageSpec {
  title: string;
  /** 已转义好的 HTML 骨架；数据一律由脚本通过 textContent 写入 */
  body: string;
  data: unknown;
  client: readonly string[];
  live?: string;
  liveFile?: LiveFile;
}

const liveMeta = (spec: PageSpec): string => [
  spec.live !== undefined ? `\n<meta name="pm-live" content="${escapeHtml(spec.live)}">` : "",
  spec.liveFile ? `\n<meta name="pm-live-file" content="${escapeHtml(spec.liveFile.file)}" data-version="${escapeHtml(spec.liveFile.version)}">` : "",
].join("");

/** 生成单文件、离线可打开的页面：样式、脚本、数据全部内嵌 */
export const renderPage = (spec: PageSpec): string => {
  const client = spec.client.map(readClient).join("\n");
  const script = `\n(() => {\n"use strict";\n${client}\n})();\n`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(script, spec.live !== undefined, spec.liveFile !== undefined)}">${liveMeta(spec)}
<title>${escapeHtml(spec.title)}</title>
<style>
${readClient("dashboard.css")}
</style>
</head>
<body>
<main>${spec.body}
</main>
<script type="application/json" id="pm-data">${serializeForScript(spec.data)}</script>
<script>${script}</script>
</body>
</html>
`;
};

export const renderDashboard = (analysis: Analysis, links: PageLinks = {}): string =>
  renderPage({ title: `${analysis.project} · 项目地图`, body: dashboardSections(links), data: toPlainData(analysis), client: DASHBOARD_CLIENT, live: links.live, liveFile: links.liveFile });
