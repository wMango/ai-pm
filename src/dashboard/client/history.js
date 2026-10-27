// ---------- 提交历史：演进曲线 + 每个提交改变了什么 ----------
// 画布与容器同宽（不放大也不缩小），提交多时横向滚动
const CURVE = { STEP: 72, PAD_L: 52, PAD_R: 28, TOP: 18, PLOT_H: 170, BAR_H: 46, GAP: 26, MIN_W: 640, FALLBACK_W: 900 };
const HISTORY_CHIP_LIMIT = 6;
const FULL_DATE = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const SHORT_DATE = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });

const entryLabel = (e) => (e.commit ? e.commit.short : "未提交");
const ratioOf = (m, key) => (m && m.total ? m[key] / m.total : 0);

/** 这一步的走向：有生效增加为进，失去生效为退，其余为平 */
const trendOf = (e) => {
  if (e.state !== "ok") return "none";
  if (!e.changes) return "start";
  if (e.changes.lostEffect.length) return "down";
  if (e.changes.becameEffective.length || e.changes.goalDeltas.some((d) => d.after > d.before)) return "up";
  return e.unchanged ? "flat" : "move";
};
const TREND_COLOR = { up: "var(--ok)", down: "var(--break)", move: "var(--doing)", flat: "var(--ink-3)", start: "var(--ink)", none: "var(--todo)" };

const renderHistoryHeader = (data) => {
  document.getElementById("project-name").textContent = data.project;
  const commits = data.entries.filter((e) => e.commit).length;
  document.getElementById("generated-at").textContent = `${commits} 个提交 · 生成于 ${new Date(data.generatedAt).toLocaleString("zh-CN")}`;
  const latest = data.entries.find((e) => e.state === "ok");
  if (!latest) return;
  const { total, built, effective } = latest.metrics;
  document.getElementById("metrics").replaceChildren(
    el("div", { class: "metric" }, [ring(pct(built / total), "var(--ink)", 76, "建成度"), el("b", {}, ["建成度"]), `${built}/${total}`]),
    el("div", { class: "metric" }, [ring(pct(effective / total), "var(--ok)", 76, "生效度"), el("b", {}, ["生效度"]), `${effective}/${total}`]),
  );
};

const curvePath = (points) => points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

const renderCurve = (data) => {
  const root = document.getElementById("history-chart");
  const entries = [...data.entries].reverse();
  const { STEP, PAD_L, PAD_R, TOP, PLOT_H, BAR_H, GAP } = CURVE;
  const available = (root.parentElement && root.parentElement.clientWidth) || CURVE.FALLBACK_W;
  const width = Math.max(CURVE.MIN_W, available, PAD_L + PAD_R + Math.max(1, entries.length - 1) * STEP);
  const span = width - PAD_L - PAD_R;
  const x = (i) => PAD_L + (entries.length > 1 ? (i * span) / (entries.length - 1) : span / 2);
  const y = (ratio) => TOP + PLOT_H - ratio * PLOT_H;
  const barTop = TOP + PLOT_H + GAP;
  const height = barTop + BAR_H + 34;
  root.replaceChildren();
  root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.style.minWidth = `${width}px`;
  [0, 0.5, 1].forEach((r) => {
    root.appendChild(svg("line", { x1: PAD_L, x2: width - PAD_R, y1: y(r), y2: y(r), stroke: "var(--line)", "stroke-dasharray": "2 4" }));
    root.appendChild(txt(PAD_L - 10, y(r) + 4, `${pct(r)}%`, { "text-anchor": "end", fill: "var(--ink-3)", "font-family": "var(--font-mono)" }));
  });
  root.appendChild(txt(PAD_L - 10, barTop + BAR_H / 2 + 4, "投入", { "text-anchor": "end", fill: "var(--ink-3)" }));
  const maxTokens = Math.max(1, ...entries.map((e) => e.stage.tokens));
  entries.forEach((e, i) => {
    const h = (e.stage.tokens / maxTokens) * BAR_H;
    if (h > 0) root.appendChild(svg("rect", { x: x(i) - 9, y: barTop + BAR_H - h, width: 18, height: h, rx: 4, fill: "var(--paper-2)", stroke: "var(--ink-3)", "stroke-width": 1 }, [svg("title", {}, [`${entryLabel(e)}：${wan(e.stage.tokens)} token · ${e.stage.sessions} 次会话`])]));
    root.appendChild(txt(x(i), height - 10, e.commit ? SHORT_DATE.format(new Date(e.commit.date)) : "现在", { "text-anchor": "middle", fill: "var(--ink-3)", "font-size": 11 }));
  });
  const tracked = entries.map((e, i) => ({ e, i })).filter(({ e }) => e.state === "ok");
  const line = (key, color) => {
    const pts = tracked.map(({ e, i }) => ({ x: x(i), y: y(ratioOf(e.metrics, key)) }));
    if (pts.length > 1) root.appendChild(svg("path", { d: curvePath(pts), fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round" }));
  };
  line("built", "var(--ink)");
  line("effective", "var(--ok)");
  entries.forEach((e, i) => {
    if (e.state !== "ok") {
      root.appendChild(svg("circle", { cx: x(i), cy: y(0), r: 4, fill: "var(--card)", stroke: "var(--todo)", "stroke-dasharray": "2 2" }, [svg("title", {}, [`${entryLabel(e)}：尚未接入 ai-pm`])]));
      return;
    }
    const built = ratioOf(e.metrics, "built"), effective = ratioOf(e.metrics, "effective");
    root.appendChild(svg("a", { href: e.page, class: "node", "aria-label": `${entryLabel(e)}：建成 ${pct(built)}%，生效 ${pct(effective)}%` }, [
      svg("title", {}, [`${entryLabel(e)} · ${e.commit ? e.commit.subject : "未提交的工作区"}\n建成 ${pct(built)}% · 生效 ${pct(effective)}%`]),
      svg("circle", { cx: x(i), cy: y(built), r: 4.5, fill: "var(--ink)" }),
      svg("circle", { class: "bubble", cx: x(i), cy: y(effective), r: 7, fill: "var(--card)", stroke: TREND_COLOR[trendOf(e)], "stroke-width": 3 }),
    ]));
  });
};

/** 名字芯片；太多时只露出前几个，其余收进 "+N" */
const refChips = (refs, kind, prefix) => {
  const one = (r) => chip(`${prefix}${r.name}`, kind);
  if (refs.length <= HISTORY_CHIP_LIMIT) return refs.map(one);
  const shown = HISTORY_CHIP_LIMIT - 1;
  return [...refs.slice(0, shown).map(one), el("details", { class: "more" }, [el("summary", { class: "chip plain" }, [`+${refs.length - shown} 个`]), el("div", { class: "chips" }, refs.slice(shown).map(one))])];
};

const changeGroups = (e) => {
  if (e.state === "untracked") return [el("span", { class: "sub" }, ["尚未接入 ai-pm：这个提交里还没有 .pm/pm.yaml"])];
  if (e.state === "invalid") return [el("span", { class: "sub" }, [`读取失败：${e.note || "pm.yaml 无效"}`])];
  if (!e.changes) return [el("span", { class: "sub" }, ["起点：从这里开始用 ai-pm 管理项目"])];
  if (e.unchanged) return [el("span", { class: "sub" }, ["状态无变化（只改了代码或文档）"])];
  const c = e.changes;
  const group = (label, items) => (items.length ? el("div", { class: "change" }, [el("span", { class: "row-label" }, [label]), el("div", { class: "chips" }, items)]) : null);
  return [
    group(`新增生效 ${c.becameEffective.length}`, refChips(c.becameEffective, "ok", "")),
    group(`失去生效 ${c.lostEffect.length}`, refChips(c.lostEffect, "blocked", "")),
    group(`建成待生效 ${c.becameBuilt.length}`, refChips(c.becameBuilt, "doing", "")),
    group(`新增模块 ${c.added.length}`, refChips(c.added, "plain", "+ ")),
    group(`移除模块 ${c.removed.length}`, refChips(c.removed, "todo", "− ")),
    group("目标", c.goalDeltas.map((d) => chip(`${d.id} ${pct(d.before)}% → ${pct(d.after)}%`, d.after > d.before ? "ok" : "blocked"))),
  ];
};

const meterRow = (label, ratio, color) => el("div", { class: "meter" }, [
  el("span", {}, [label]),
  svg("svg", { viewBox: "0 0 100 8", preserveAspectRatio: "none", role: "img", "aria-label": `${label} ${pct(ratio)}%` }, [
    svg("rect", { width: 100, height: 8, rx: 4, fill: "var(--paper-2)" }),
    svg("rect", { width: 100 * ratio, height: 8, rx: 4, fill: color }),
  ]),
  el("b", { class: "mono" }, [`${pct(ratio)}%`]),
]);

const commitRow = (e) => {
  const trend = trendOf(e);
  const when = e.commit ? FULL_DATE.format(new Date(e.commit.date)) : "现在";
  const side = e.state === "ok" ? [
    meterRow("建成", ratioOf(e.metrics, "built"), "var(--ink)"),
    meterRow("生效", ratioOf(e.metrics, "effective"), "var(--ok)"),
    el("div", { class: "stage" }, [e.stage.tokens ? `本阶段 ${wan(e.stage.tokens)} token · ${e.stage.sessions} 次会话` : "本阶段没有记录 token"]),
    el("a", { class: "open", href: e.page }, ["查看当时的地图 →"]),
  ] : [el("div", { class: "stage" }, [e.stage.tokens ? `本阶段 ${wan(e.stage.tokens)} token` : ""])];
  return el("li", { class: `commit-row trend-${trend}${e.state !== "ok" ? " muted" : ""}` }, [
    el("div", { class: "rail", "aria-hidden": "true" }, [el("i", { style: `border-color:${TREND_COLOR[trend]}` })]),
    el("div", { class: "when" }, [el("b", { class: "mono" }, [entryLabel(e)]), el("span", {}, [when])]),
    el("div", { class: "what" }, [el("h3", {}, [e.commit ? e.commit.subject : "未提交的工作区"]), ...changeGroups(e)]),
    el("div", { class: "side" }, side),
  ]);
};

const bootHistory = () => {
  let data;
  try {
    data = JSON.parse(document.getElementById("pm-data").textContent);
  } catch (error) {
    document.querySelector("main").prepend(el("p", { class: "render-error" }, [`数据读取失败：${error && error.message ? error.message : String(error)}`]));
    return;
  }
  const steps = [
    ["页头", () => renderHistoryHeader(data)],
    ["演进曲线", () => renderCurve(data)],
    ["提交列表", () => fill(document.getElementById("history-list"), data.entries.length ? data.entries.map(commitRow) : [emptyState("还没有提交。")])],
  ];
  steps.forEach(([name, run]) => {
    try { run(); } catch (error) {
      document.querySelector("main").prepend(el("p", { class: "render-error" }, [`视图渲染出错（${name}）：${error && error.message ? error.message : String(error)}`]));
      console.error(error);
    }
  });
};

bootHistory();
