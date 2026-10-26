// ---------- ① 架构地图 + 模块详情面板 ----------
const MAP = { NODE_W: 150, NODE_H: 46, GAP_X: 34, ROW_H: 112, LABEL_W: 96, TOP: 64, MIN_W: 720, NAME_MAX: 9 };
const LAYER_ORDER = ["front", "service", "data", "external"];

/** 逻辑视图按分层排行；功能 / 物理视图按依赖深度排行（被依赖的在下） */
const rowsOf = (ctx, view) => {
  const ids = ctx.data.nodes.filter((n) => n.view === view).map((n) => n.id);
  if (view === "logical") {
    return LAYER_ORDER.map((layer) => ({ label: LAYER_LABEL[layer], ids: ids.filter((id) => ctx.node(id).layer === layer) }))
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
    .map((lv, i) => ({ label: `第 ${i + 1} 层`, ids: ids.filter((id) => level(id) === lv) }))
    .filter((r) => r.ids.length);
};

const layoutOf = (ctx, view) => {
  const rows = rowsOf(ctx, view);
  const step = MAP.NODE_W + MAP.GAP_X;
  const width = Math.max(MAP.MIN_W, MAP.LABEL_W + Math.max(1, ...rows.map((r) => r.ids.length)) * step + 20);
  const pos = new Map();
  rows.forEach((row, i) => {
    const start = MAP.LABEL_W + (width - MAP.LABEL_W - row.ids.length * step) / 2 + step / 2;
    row.ids.forEach((id, j) => pos.set(id, { x: start + j * step, y: MAP.TOP + i * MAP.ROW_H }));
  });
  return { rows, pos, width, height: MAP.TOP + rows.length * MAP.ROW_H - 30 };
};

const closureWithin = (start, next) => {
  const seen = new Set();
  const walk = (id) => { if (seen.has(id)) return; seen.add(id); next(id).forEach(walk); };
  walk(start);
  return seen;
};

const stateIn = (ctx, id, mode) => {
  const n = ctx.node(id);
  if (mode === "built") return n.status === "done" ? "ok" : n.status;
  return n.state;
};

const edgePath = (a, b) => {
  const { NODE_W: W, NODE_H: H } = MAP;
  if (Math.abs(a.y - b.y) < 1) {
    const dir = b.x > a.x ? 1 : -1;
    return `M${a.x + (dir * W) / 2},${a.y} L${b.x - dir * (W / 2 + 6)},${b.y}`;
  }
  const down = b.y > a.y;
  const sy = a.y + (down ? H / 2 : -H / 2);
  const ty = b.y + (down ? -H / 2 - 6 : H / 2 + 6);
  const my = (sy + ty) / 2;
  return `M${a.x},${sy} C${a.x},${my} ${b.x},${my} ${b.x},${ty}`;
};

const drawEdges = (ctx, root, layout, state, focus) => {
  layout.pos.forEach((from, id) => {
    ctx.depsOf(id).forEach((e) => {
      const to = layout.pos.get(e.to);
      if (!to) return;
      const broken = state.mode === "effective" && e.kind === "hard" && !ctx.node(e.to).effective;
      const color = state.mode === "built" || e.kind === "soft" ? "var(--ink-3)" : broken ? "var(--break)" : "var(--ok)";
      const marker = state.mode === "built" || e.kind === "soft" ? "arrow-muted" : broken ? "arrow-break" : "arrow-ok";
      root.appendChild(svg("path", {
        d: edgePath(from, to), fill: "none", stroke: color, "stroke-width": broken ? 2.4 : 2,
        "stroke-dasharray": e.kind === "soft" ? "2 4" : broken ? "6 5" : null, "marker-end": `url(#${marker})`,
        class: `${broken ? "pulse" : ""}${focus && !(focus.has(id) && focus.has(e.to)) ? " dim" : ""}`,
      }));
    });
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

const renderMap = (ctx, state) => {
  const root = document.getElementById("map-svg");
  const layout = layoutOf(ctx, state.view);
  root.replaceChildren();
  root.setAttribute("viewBox", `0 0 ${layout.width} ${Math.max(layout.height, 140)}`);
  root.style.minWidth = `${Math.min(layout.width, 900)}px`;
  const inView = state.selected && layout.pos.has(state.selected);
  const focus = inView ? new Set([
    ...closureWithin(state.selected, (x) => ctx.depsOf(x).map((e) => e.to)),
    ...closureWithin(state.selected, (x) => ctx.dependentsOf(x).map((e) => e.from)),
  ]) : null;
  root.appendChild(svg("defs", {}, [arrowMarker("arrow-ok", "var(--ok)"), arrowMarker("arrow-break", "var(--break)"), arrowMarker("arrow-muted", "var(--ink-3)")]));
  layout.rows.forEach((row, i) => {
    const y = MAP.TOP + i * MAP.ROW_H;
    root.appendChild(svg("rect", { x: 0, y: y - 50, width: layout.width, height: 100, rx: 10, fill: i % 2 ? "transparent" : "var(--paper-2)", opacity: 0.55 }));
    root.appendChild(txt(16, y + 5, row.label, { "font-weight": 700, fill: "var(--ink-3)", "font-size": 13 }));
  });
  if (!layout.rows.length) root.appendChild(txt(layout.width / 2, 80, `${VIEW_LABEL[state.view]}视图还没有节点`, { "text-anchor": "middle", fill: "var(--ink-3)" }));
  drawEdges(ctx, root, layout, state, focus);
  layout.pos.forEach((p, id) => drawNode(ctx, root, id, p, state, focus));
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === state.view)));
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === state.mode)));
};

const jumpChips = (ctx, ids, emptyText = "—") => el("div", { class: "chips" },
  ids.length ? ids.map((id) => chip(`${ctx.node(id).name}${ctx.node(id).view !== "logical" ? `（${VIEW_LABEL[ctx.node(id).view]}）` : ""}`, ctx.node(id).state, { "data-jump": id }))
    : [el("span", { class: "sub" }, [emptyText])]);

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
