// ---------- ① 架构地图 + 模块详情面板 ----------
// 节点尺寸固定、画布跟着容器宽度走：层里放不下就折行，而不是把整张图缩小到看不清
const MAP = { NODE_W: 150, NODE_H: 46, GAP_X: 34, LINE_H: 74, BAND_PAD: 22, BAND_GAP: 10, LABEL_W: 96, TOP: 8, MIN_W: 720, FALLBACK_W: 1000, NAME_MAX: 9 };
/** 一层超过这么多行就把已生效的模块收成一叠；可见连线超过这么多条就只画关键连线 */
const CROWD = { FOLD_LINES: 2, EDGE_LIMIT: 30 };
const LAYER_ORDER = ["front", "service", "data", "external"];
/** 拥挤时层内排序：问题在前，已生效在后 */
const STATE_RANK = { blocked: 0, doing: 1, todo: 2, ok: 3 };

/** 逻辑视图按分层排行；功能 / 物理视图按依赖深度排行（被依赖的在下） */
const rowsOf = (ctx, view) => {
  const ids = ctx.data.nodes.filter((n) => n.view === view).map((n) => n.id);
  if (view === "logical") {
    return LAYER_ORDER.map((layer) => ({ key: `${view}:${layer}`, label: LAYER_LABEL[layer], ids: ids.filter((id) => ctx.node(id).layer === layer) }))
      .filter((r) => r.ids.length);
  }
  const memo = new Map();
  const level = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = ctx.depsOf(id).map((e) => e.to).filter((d) => ids.includes(d));
    const value = deps.length ? 1 + Math.max(...deps.map((d) => level(d, seen))) : 0;
    memo.set(id, value);
    return value;
  };
  const maxLevel = Math.max(0, ...ids.map((id) => level(id)));
  return Array.from({ length: maxLevel + 1 }, (_, i) => maxLevel - i)
    .map((lv, i) => ({ key: `${view}:${lv}`, label: `第 ${i + 1} 层`, ids: ids.filter((id) => level(id) === lv) }))
    .filter((r) => r.ids.length);
};

const stateIn = (ctx, id, mode) => {
  const n = ctx.node(id);
  if (mode === "built") return n.status === "done" ? "ok" : n.status;
  return n.state;
};

/** 一行放得下就保持声明顺序；放不下时问题优先；超过两行、且层里确有问题模块时，才把健康模块收起来突出问题 */
const arrangeRow = (ctx, row, state, cols) => {
  if (row.ids.length <= cols) return { ids: row.ids, folded: [], foldable: false };
  const rank = (id) => STATE_RANK[stateIn(ctx, id, state.mode)];
  const ranked = [...row.ids].sort((a, b) => rank(a) - rank(b));
  const healthy = ranked.filter((id) => rank(id) === STATE_RANK.ok && id !== state.selected);
  const hasProblem = ranked.some((id) => rank(id) !== STATE_RANK.ok);
  const foldable = row.ids.length > cols * CROWD.FOLD_LINES && healthy.length > 1 && hasProblem;
  if (!foldable || state.expanded.has(row.key)) return { ids: ranked, folded: [], foldable };
  return { ids: ranked.filter((id) => !healthy.includes(id)), folded: healthy, foldable };
};

const layoutOf = (ctx, state, available) => {
  const width = Math.max(MAP.MIN_W, available);
  const step = MAP.NODE_W + MAP.GAP_X;
  const cols = Math.max(2, Math.floor((width - MAP.LABEL_W - 10) / step));
  const pos = new Map();
  const folds = [];
  let top = MAP.TOP;
  const rows = rowsOf(ctx, state.view).map((row) => {
    const items = arrangeRow(ctx, row, state, cols);
    const slots = [...items.ids, ...(items.foldable ? [null] : [])];
    const lines = Math.ceil(slots.length / cols);
    const height = MAP.BAND_PAD * 2 + MAP.NODE_H + (lines - 1) * MAP.LINE_H;
    slots.forEach((id, k) => {
      const line = Math.floor(k / cols);
      const count = Math.min(cols, slots.length - line * cols);
      const x = MAP.LABEL_W + (width - MAP.LABEL_W - count * step) / 2 + step / 2 + (k % cols) * step;
      const p = { x, y: top + MAP.BAND_PAD + MAP.NODE_H / 2 + line * MAP.LINE_H };
      if (id) pos.set(id, p);
      else folds.push({ ...p, key: row.key, ids: items.folded, open: !items.folded.length, total: row.ids.length });
    });
    const band = { ...row, top, height };
    top += height + MAP.BAND_GAP;
    return band;
  });
  // 收起的模块，连线落在那一叠上
  const anchor = new Map(pos);
  folds.forEach((f) => f.ids.forEach((id) => anchor.set(id, f)));
  return { rows, pos, folds, anchor, width, height: top };
};

const closureWithin = (start, next) => {
  const seen = new Set();
  const walk = (id) => { if (seen.has(id)) return; seen.add(id); next(id).forEach(walk); };
  walk(start);
  return seen;
};

const edgePath = (a, b) => {
  const { NODE_W: W, NODE_H: H } = MAP;
  if (Math.abs(a.y - b.y) < 1) {
    const dir = b.x > a.x ? 1 : -1;
    if (Math.abs(b.x - a.x) <= W + MAP.GAP_X + 1) return `M${a.x + (dir * W) / 2},${a.y} L${b.x - dir * (W / 2 + 6)},${b.y}`;
    // 同一行隔着别的节点：从上方绕过去，不穿过中间的模块
    const sy = a.y - H / 2;
    return `M${a.x},${sy} C${a.x},${sy - 26} ${b.x},${sy - 26} ${b.x},${sy - 6}`;
  }
  const down = b.y > a.y;
  const sy = a.y + (down ? H / 2 : -H / 2);
  const ty = b.y + (down ? -H / 2 - 6 : H / 2 + 6);
  const my = (sy + ty) / 2;
  return `M${a.x},${sy} C${a.x},${my} ${b.x},${my} ${b.x},${ty}`;
};

/** 收集可见连线；太密时只保留关键连线：选中模块的链路，否则只留断开的依赖 */
const edgesOf = (ctx, layout, state, focus) => {
  const all = new Map();
  layout.anchor.forEach((from, id) => {
    ctx.depsOf(id).forEach((e) => {
      const to = layout.anchor.get(e.to);
      if (!to || to === from) return;
      const broken = state.mode === "effective" && e.kind === "hard" && !ctx.node(e.to).effective;
      const key = `${from.x},${from.y}>${to.x},${to.y}`;
      const prev = all.get(key);
      if (!prev || (broken && !prev.broken)) all.set(key, { id, to: e.to, kind: e.kind, broken, a: from, b: to });
    });
  });
  const edges = [...all.values()];
  const dense = edges.length > CROWD.EDGE_LIMIT;
  if (!dense || state.allEdges) return { edges, dense, hidden: 0 };
  const kept = edges.filter((e) => (focus ? focus.has(e.id) && focus.has(e.to) : e.broken));
  return { edges: kept, dense, hidden: edges.length - kept.length };
};

const drawEdges = (root, edges, state, focus) => {
  edges.forEach((e) => {
    const muted = state.mode === "built" || e.kind === "soft";
    const color = muted ? "var(--ink-3)" : e.broken ? "var(--break)" : "var(--ok)";
    const marker = muted ? "arrow-muted" : e.broken ? "arrow-break" : "arrow-ok";
    root.appendChild(svg("path", {
      d: edgePath(e.a, e.b), fill: "none", stroke: color, "stroke-width": e.broken ? 2.4 : 2,
      "stroke-dasharray": e.kind === "soft" ? "2 4" : e.broken ? "6 5" : null, "marker-end": `url(#${marker})`,
      class: `${e.broken ? "pulse" : ""}${focus && !(focus.has(e.id) && focus.has(e.to)) ? " dim" : ""}`,
    }));
  });
};

const drawNode = (ctx, root, id, p, state, focus) => {
  const n = ctx.node(id);
  const st = stateIn(ctx, id, state.mode);
  const meta = STATE_META[st];
  const { NODE_W: W, NODE_H: H } = MAP;
  root.appendChild(svg("g", {
    class: `node${focus && !focus.has(id) ? " dim" : ""}`, tabindex: 0, role: "button", "data-id": id, "data-state": st,
    "aria-label": `${n.name}，${meta.label}`, transform: `translate(${p.x - W / 2},${p.y - H / 2})`,
  }, [
    svg("title", {}, [n.name]),
    id === state.selected ? svg("rect", { x: -6, y: -6, width: W + 12, height: H + 12, rx: 14, fill: "none", stroke: "var(--ink)", "stroke-dasharray": "3 3" }) : null,
    svg("rect", { class: "body", width: W, height: H, rx: 9, fill: meta.tint, stroke: meta.color, "stroke-width": 2.2, "stroke-dasharray": meta.dashed ? "6 4" : null }),
    svg("rect", { width: 8, height: H, rx: 4, fill: meta.color, opacity: meta.dashed ? 0.4 : 1 }),
    txt(W / 2 + 4, H / 2 + 5, clip(n.name, MAP.NAME_MAX), { "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: "var(--ink)" }),
    state.mode === "effective" && n.crossViewBlocked ? svg("g", { transform: `translate(${W - 6},-6)` }, [
      svg("circle", { r: 10, fill: "var(--break)" }), txt(0, 4, "⇡", { "text-anchor": "middle", fill: "#fff", "font-weight": 900 }),
    ]) : null,
    n.pendingReview ? svg("g", { transform: "translate(6,-6)" }, [
      svg("rect", { x: -7, y: -7, width: 14, height: 14, transform: "rotate(45)", fill: "var(--doing)" }),
    ]) : null,
  ]));
};

/** 收起的健康模块画成一叠卡片；展开后变成"收起"按钮 */
const drawFold = (ctx, root, fold, state, focus) => {
  const { NODE_W: W, NODE_H: H } = MAP;
  const word = state.mode === "built" ? "已完成" : "已生效";
  const label = fold.open ? `▴ 收起${word}` : `${fold.ids.length} 个${word} ▸`;
  const names = fold.ids.map((id) => ctx.node(id).name).join("、");
  const faded = focus && !fold.ids.some((id) => focus.has(id));
  root.appendChild(svg("g", {
    class: `node fold${faded ? " dim" : ""}`, tabindex: 0, role: "button", "data-fold": fold.key, "aria-expanded": String(fold.open),
    "aria-label": fold.open ? `收起这一层${word}的模块` : `展开 ${fold.ids.length} 个${word}的模块：${names}`,
    transform: `translate(${fold.x - W / 2},${fold.y - H / 2})`,
  }, [
    svg("title", {}, [fold.open ? "收起" : names]),
    ...(fold.open ? [] : [8, 4].map((d) => svg("rect", { x: d, y: -d, width: W, height: H, rx: 9, fill: "var(--ok-tint)", stroke: "var(--ok)", "stroke-width": 1.2, opacity: 0.6 }))),
    svg("rect", { class: "body", width: W, height: H, rx: 9, fill: fold.open ? "var(--card)" : "var(--ok-tint)", stroke: "var(--ok)", "stroke-width": 2, "stroke-dasharray": fold.open ? "5 4" : null }),
    txt(W / 2, H / 2 + 5, label, { "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--ok)" }),
  ]));
};

const renderHint = (thin, mode, state) => {
  const hint = document.getElementById("map-hint");
  if (!hint) return;
  hint.hidden = !thin.dense;
  if (!thin.dense) return;
  const kept = state.selected ? "只显示所选模块的上下游链路" : mode === "effective" ? "只显示断开的依赖（红线）" : "默认不画依赖连线";
  hint.replaceChildren(
    el("span", {}, [state.allEdges ? "已显示全部连线。" : `模块较多，${kept}；点击模块查看它的完整链路。`]),
    el("button", { type: "button", class: "chip plain", "aria-pressed": String(state.allEdges) }, [state.allEdges ? "只看关键连线" : `显示全部连线（另有 ${thin.hidden} 条）`]),
  );
};

const renderMap = (ctx, state) => {
  const root = document.getElementById("map-svg");
  const available = (root.parentElement && root.parentElement.clientWidth) || MAP.FALLBACK_W;
  const layout = layoutOf(ctx, state, available);
  root.replaceChildren();
  root.setAttribute("viewBox", `0 0 ${layout.width} ${Math.max(layout.height, 140)}`);
  // 不允许缩小：放不下时横向滚动，字号始终可读
  root.style.minWidth = `${layout.width}px`;
  const inView = state.selected && layout.pos.has(state.selected);
  const focus = inView ? new Set([
    ...closureWithin(state.selected, (x) => ctx.depsOf(x).map((e) => e.to)),
    ...closureWithin(state.selected, (x) => ctx.dependentsOf(x).map((e) => e.from)),
  ]) : null;
  root.appendChild(svg("defs", {}, [arrowMarker("arrow-ok", "var(--ok)"), arrowMarker("arrow-break", "var(--break)"), arrowMarker("arrow-muted", "var(--ink-3)")]));
  layout.rows.forEach((row, i) => {
    root.appendChild(svg("rect", { x: 0, y: row.top, width: layout.width, height: row.height, rx: 10, fill: i % 2 ? "transparent" : "var(--paper-2)", opacity: 0.55 }));
    root.appendChild(txt(16, row.top + MAP.BAND_PAD + MAP.NODE_H / 2 + 5, row.label, { "font-weight": 700, fill: "var(--ink-3)", "font-size": 13 }));
    if (row.ids.length > 1) root.appendChild(txt(16, row.top + MAP.BAND_PAD + MAP.NODE_H / 2 + 23, `${row.ids.length} 个`, { fill: "var(--ink-3)", "font-size": 11, "font-family": "var(--font-mono)" }));
  });
  if (!layout.rows.length) root.appendChild(txt(layout.width / 2, 80, `${VIEW_LABEL[state.view]}视图还没有节点`, { "text-anchor": "middle", fill: "var(--ink-3)" }));
  const thin = edgesOf(ctx, layout, state, focus);
  drawEdges(root, thin.edges, state, focus);
  layout.pos.forEach((p, id) => drawNode(ctx, root, id, p, state, focus));
  layout.folds.forEach((f) => drawFold(ctx, root, f, state, focus));
  renderHint(thin, state.mode, state);
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === state.view)));
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === state.mode)));
};

/** 芯片太多时只露出前面几个，其余收进"+N" */
const CHIP_LIMIT = 10;
const jumpChips = (ctx, ids, emptyText = "—") => {
  const one = (id) => chip(`${ctx.node(id).name}${ctx.node(id).view !== "logical" ? `（${VIEW_LABEL[ctx.node(id).view]}）` : ""}`, ctx.node(id).state, { "data-jump": id });
  if (!ids.length) return el("div", { class: "chips" }, [el("span", { class: "sub" }, [emptyText])]);
  if (ids.length <= CHIP_LIMIT) return el("div", { class: "chips" }, ids.map(one));
  const shown = CHIP_LIMIT - 1;
  return el("div", { class: "chips" }, [
    ...ids.slice(0, shown).map(one),
    el("details", { class: "more" }, [el("summary", { class: "chip plain" }, [`+${ids.length - shown} 个`]), el("div", { class: "chips" }, ids.slice(shown).map(one))]),
  ]);
};


const renderPanel = (ctx, state) => {
  const root = document.getElementById("panel");
  if (!state.selected) {
    root.replaceChildren(el("h3", {}, ["点击一个模块"]), el("p", { class: "sub" }, ["查看它的依赖、跨视图映射、根因阻塞、所属目标与成本。"]));
    return;
  }
  const n = ctx.node(state.selected);
  const where = `${VIEW_LABEL[n.view]}视图${n.layer ? ` · ${LAYER_LABEL[n.layer]}` : ""}`;
  const row = (label, content) => [el("dt", {}, [label]), el("dd", {}, [content])];
  root.replaceChildren(
    el("div", {}, [el("div", { class: "eyebrow" }, [where]), el("h3", {}, [n.name])]),
    el("div", { class: "chips" }, [
      chip(STATE_META[n.state].label, n.state),
      n.crossViewBlocked ? chip("跨视图阻塞", "blocked") : null,
      n.pendingReview ? chip("待复核", "doing") : null,
    ]),
    el("dl", { class: "kv" }, [
      ...row("依赖", jumpChips(ctx, ctx.depsOf(n.id).map((e) => e.to))),
      ...row("被依赖", jumpChips(ctx, ctx.dependentsOf(n.id).map((e) => e.from))),
      ...row("支撑于", jumpChips(ctx, ctx.supportsOf(n.id).map((e) => e.to))),
      ...row("支撑了", jumpChips(ctx, ctx.supportedBy(n.id).map((e) => e.from))),
      ...row("目标", el("div", { class: "chips" }, n.goals.length ? n.goals.map((g) => chip(g)) : [el("span", { class: "sub" }, ["—"])])),
      ...row("成本", el("span", { class: "mono" }, [n.tokens ? `${wan(n.tokens)} token · ${n.days.toFixed(1)} 天` : "—"])),
    ]),
    n.rootBlockers.length
      ? el("div", { class: "callout" }, [el("b", {}, ["根因阻塞："]), jumpChips(ctx, n.rootBlockers)])
      : el("div", { class: "callout good" }, [n.effective ? "已生效，上游链路畅通。" : "上游没有阻塞，完成自身验收即可生效。"]),
  );
};
