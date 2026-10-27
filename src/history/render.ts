// 历史目录页与每个提交的地图页
import type { Analysis } from "../analyze.js";
import { renderDashboard, renderPage } from "../dashboard/render.js";
import type { HistoryEntry } from "./timeline.js";

const HISTORY_CLIENT = ["util.js", "history.js"] as const;
export const INDEX_PAGE = "index.html";
/** 历史页放在 .pm/history/，当前地图在上一级 */
const CURRENT_MAP = "../dashboard.html";

const indexSections = `
<nav class="crumb" aria-label="位置"><a href="${CURRENT_MAP}">← 当前地图</a><span><b>提交历史</b>每个提交是一个阶段的完成点</span></nav>
<header class="top">
  <div>
    <div class="eyebrow">项目地图 · 按提交回看</div>
    <h1 id="project-name"></h1>
    <p class="sub" id="generated-at"></p>
  </div>
  <div id="metrics" class="metrics"></div>
</header>
<section id="curve-section">
  <h2>演进曲线</h2>
  <p class="sub">每个点是一次提交：深色是建成度，绿色是生效度，底部的柱是这一阶段投入的 token。点击查看当时的地图。</p>
  <div class="card pad"><div class="scroll-x"><svg id="history-chart" role="img" aria-label="建成度与生效度随提交的变化"></svg></div></div>
</section>
<section id="list-section">
  <h2>提交</h2>
  <p class="sub">从新到旧；每行写明这一步让哪些模块生效、哪些被卡住，以及目标进度怎么变。</p>
  <ol id="history-list" class="commit-list"></ol>
</section>
<footer>本页离线可用 · 由 ai-pm-engine 按 git 历史生成，可随时重算</footer>`;

export interface HistoryPageData {
  project: string;
  generatedAt: string;
  entries: HistoryEntry[];
}

export const renderHistoryIndex = (data: HistoryPageData): string =>
  renderPage({ title: `${data.project} · 提交历史`, body: indexSections, data, client: HISTORY_CLIENT });

const DATE = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** 某个提交（或工作区）上的地图，顶部带回到目录的导航 */
export const renderSnapshotPage = (entry: HistoryEntry, analysis: Analysis): string => {
  const title = entry.commit ? `提交 ${entry.commit.short}` : "未提交的工作区";
  const detail = entry.commit ? `${DATE.format(new Date(entry.commit.date))} · ${entry.commit.subject}` : "当前尚未提交的改动";
  return renderDashboard(analysis, { crumb: { href: INDEX_PAGE, label: "← 全部提交", title, detail } });
};
