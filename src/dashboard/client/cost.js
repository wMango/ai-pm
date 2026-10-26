// ---------- ④ 成本：时间 × token 气泡图 + 汇总 ----------
const COST = { X0: 80, X1: 640, Y0: 300, Y1: 24, WIDTH: 680, HEIGHT: 360 };
const LABEL_GAP = 16;
const CHAR_W = 12;

/** 取 1/2/5 × 10^n 的整齐上限，便于刻度阅读 */
const niceCeil = (value) => {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= value);
};

const renderCostChart = (ctx, spent) => {
  const root = document.getElementById("cost-svg");
  const { X0, X1, Y0, Y1 } = COST;
  const stuckDays = ctx.data.settings.stuckDays;
  const maxDays = Math.max(Math.ceil(Math.max(...spent.map((n) => n.days))) + 1, stuckDays + 2);
  const maxTokens = niceCeil(Math.max(...spent.map((n) => n.tokens)) * 1.1);
  const sx = (d) => X0 + (d / maxDays) * (X1 - X0);
  const sy = (t) => Y0 - (t / maxTokens) * (Y0 - Y1);
  const radius = (t) => 8 + Math.sqrt(t / maxTokens) * 26;
  root.replaceChildren();
  root.setAttribute("viewBox", `0 0 ${COST.WIDTH} ${COST.HEIGHT}`);
  root.style.minWidth = "560px";
  const dayStep = Math.max(1, Math.ceil(maxDays / 8));
  for (let d = 0; d <= maxDays; d += dayStep) {
    root.appendChild(svg("line", { x1: sx(d), x2: sx(d), y1: Y1, y2: Y0, stroke: "var(--line)", "stroke-dasharray": "2 4" }));
    root.appendChild(txt(sx(d), Y0 + 20, `${d}天`, { "text-anchor": "middle", fill: "var(--ink-3)", "font-family": "var(--font-mono)" }));
  }
  for (let i = 0; i <= 4; i++) {
    const t = (maxTokens * i) / 4;
    root.appendChild(svg("line", { x1: X0, x2: X1, y1: sy(t), y2: sy(t), stroke: "var(--line)", "stroke-dasharray": "2 4" }));
    root.appendChild(txt(X0 - 10, sy(t) + 4, wan(t), { "text-anchor": "end", fill: "var(--ink-3)", "font-family": "var(--font-mono)" }));
  }
  root.appendChild(svg("rect", { x: sx(stuckDays), y: Y1, width: X1 - sx(stuckDays), height: Y0 - Y1, fill: "var(--break)", opacity: 0.06 }));
  root.appendChild(svg("line", { x1: sx(stuckDays), x2: sx(stuckDays), y1: Y1, y2: Y0, stroke: "var(--break)", "stroke-dasharray": "6 4" }));
  root.appendChild(txt(sx(stuckDays) + 8, Y0 - 10, `${stuckDays} 天预警线`, { fill: "var(--break)", "font-weight": 700 }));
  const stuck = new Set(ctx.data.cost.stuck);
  const placed = [];
  /** 简单避让：标签与已放置的标签重叠时向上挪 */
  const labelY = (x1, x2, y) => {
    let ty = y;
    while (placed.some((p) => x1 < p.x2 && x2 > p.x1 && Math.abs(ty - p.y) < LABEL_GAP)) ty -= LABEL_GAP;
    placed.push({ x1, x2, y: ty });
    return ty;
  };
  [...spent].sort((a, b) => b.tokens - a.tokens).forEach((n) => {
    const meta = STATE_META[n.state];
    const cx = sx(n.days), cy = sy(n.tokens), r = radius(n.tokens);
    // 靠右的气泡把标签放在上方，避免压到左边相邻的气泡
    const above = cx > X1 - 200;
    const label = `${clip(n.name, 8)}${stuck.has(n.id) ? " · 卡住" : ""}`;
    const lw = label.length * CHAR_W;
    const lx = above ? cx : cx + r + 6;
    const ly = labelY(above ? cx - lw / 2 : lx, above ? cx + lw / 2 : lx + lw, above ? cy - r - 12 : cy + 4);
    root.appendChild(svg("g", { class: "node", "data-jump": n.id, tabindex: 0, role: "button", "aria-label": `${n.name}：${wan(n.tokens)} token，${n.days.toFixed(1)} 天` }, [
      svg("title", {}, [n.name]),
      stuck.has(n.id) ? svg("circle", { cx, cy, r: r + 8, fill: "none", stroke: "var(--break)", "stroke-width": 2, class: "pulse" }) : null,
      svg("circle", { class: "bubble", cx, cy, r, fill: meta.tint, stroke: meta.color, "stroke-width": 2.4, "stroke-dasharray": meta.dashed ? "5 4" : null }),
      txt(lx, ly, label, { "text-anchor": above ? "middle" : "start", "font-weight": 700, fill: "var(--ink)" }),
    ]));
  });
  const idle = ctx.data.nodes.filter((n) => !n.tokens).length;
  root.appendChild(txt(X0, Y0 + 48, `尚未投入的模块：${idle} 个 · 气泡大小 ∝ token`, { fill: "var(--ink-3)" }));
};

const renderCostSide = (ctx) => {
  const c = ctx.data.cost;
  const sunk = pct(c.sunkTokens / c.totalTokens);
  const states = ["ok", "blocked", "doing"].filter((s) => c.byState[s] > 0);
  let x = 0;
  const stacked = svg("svg", { viewBox: "0 0 260 16", preserveAspectRatio: "none", style: "width:100%;height:16px", role: "img", "aria-label": "按状态分布" },
    states.map((s) => { const w = (c.byState[s] / c.totalTokens) * 260; const r = svg("rect", { x, width: Math.max(w - 2, 0), height: 16, rx: 4, fill: STATE_META[s].color }); x += w; return r; }));
  const goalRows = ctx.data.goals.map((g) => el("div", { style: "display:grid;grid-template-columns:40px 1fr 60px;gap:8px;align-items:center;font-size:.8rem" }, [
    el("b", { class: "mono" }, [g.id]),
    svg("svg", { viewBox: "0 0 100 10", preserveAspectRatio: "none", style: "width:100%;height:10px" }, [
      svg("rect", { width: 100, height: 10, rx: 3, fill: "var(--paper-2)" }),
      svg("rect", { width: ((c.byGoal[g.id] || 0) / c.totalTokens) * 100, height: 10, rx: 3, fill: "var(--ink)" }),
    ]),
    el("span", { class: "mono", style: "text-align:right" }, [wan(c.byGoal[g.id] || 0)]),
  ]));
  document.getElementById("cost-side").replaceChildren(
    el("div", { class: "kpi-label", style: "margin-top:0" }, ["累计消耗 token"]), el("div", { class: "kpi" }, [wan(c.totalTokens)]),
    el("div", { style: "display:flex;gap:12px;align-items:center;margin-top:14px" }, [
      ring(sunk, "var(--blocked)", 80, "沉没成本占比"),
      el("div", { style: "font-size:.85rem" }, [el("b", {}, ["沉没风险"]), el("br"), `${wan(c.sunkTokens)} 花在未生效的模块上`]),
    ]),
    el("div", { class: "kpi-label" }, ["按生效状态"]), stacked,
    el("div", { class: "chips", style: "margin-top:6px" }, states.map((s) => chip(`${STATE_META[s].label} ${wan(c.byState[s])}`, s))),
    goalRows.length ? el("div", { class: "kpi-label" }, ["按目标（共享模块重复计入）"]) : null, ...goalRows,
    c.stuck.length ? el("div", { class: "callout", style: "margin-top:12px" }, [el("b", {}, ["卡住预警："]), jumpChips(ctx, c.stuck)]) : null,
    c.unassignedTokens ? el("div", { class: "kpi-label" }, [`另有 ${wan(c.unassignedTokens)} token 未归属任何模块（会话里没有先 pm start）`]) : null,
  );
};

const renderCost = (ctx) => {
  const spent = ctx.data.nodes.filter((n) => n.tokens > 0);
  if (!spent.length) {
    document.getElementById("cost-body").replaceChildren(el("div", { class: "card" }, [emptyState("还没有成本记录：会话结束时写入 .pm/ledger.jsonl 后，这里会出现气泡图。")]));
    return;
  }
  renderCostChart(ctx, spent);
  renderCostSide(ctx);
};
