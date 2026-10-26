// ---------- ⑤ 旅程蓝图：服务蓝图泳道 + 可用性曲线 + 故事地图切线 ----------
const BP = { LABEL_W: 120, COL_W: 230, CHIP_W: 150, CHIP_H: 26, CHIP_GAP: 6, LANE_PAD: 18, CURVE_TOP: 20, CURVE_H: 60, USER_H: 70 };
const BP_LANES = [["front", "前台"], ["back", "后台"], ["support", "支撑系统"]];
const BP_LINES = ["交互线", "可见线 · 用户看不到以下", "内部交互线"];
const STEP_STYLE = {
  ok: { color: "var(--ok)", y: 0, verdict: () => "✓ 可以走通" },
  broken: { color: "var(--break)", y: 1, verdict: (root) => `✗ 断在：${root}` },
  gap: { color: "var(--blocked)", y: 0.5, verdict: () => "? 映射缺口：没有实现组件" },
};

/** 每条泳道的高度按本蓝图里最多的节点数决定 */
const laneGeometry = (bp) => {
  let y = BP.CURVE_TOP + BP.CURVE_H + 16;
  const user = { top: y, bottom: y + BP.USER_H };
  y = user.bottom + 12;
  const lanes = BP_LANES.map(([key, label]) => {
    const count = Math.max(1, ...bp.steps.map((s) => s.lanes[key].length));
    const height = count * (BP.CHIP_H + BP.CHIP_GAP) + BP.LANE_PAD * 2;
    const lane = { key, label, top: y, bottom: y + height };
    y = lane.bottom + 12;
    return lane;
  });
  return { user, lanes, verdictY: y + 18, height: y + 56 };
};

const drawLaneFrame = (root, geo, width) => {
  root.appendChild(txt(14, BP.CURVE_TOP + BP.CURVE_H / 2 + 4, "可用性曲线", { "font-weight": 700, fill: "var(--ink-3)" }));
  [{ ...geo.user, label: "用户行为" }, ...geo.lanes].forEach((l, i) => {
    root.appendChild(svg("rect", { x: 0, y: l.top, width, height: l.bottom - l.top, rx: 8, fill: i % 2 ? "transparent" : "var(--paper-2)", opacity: 0.55 }));
    root.appendChild(txt(14, (l.top + l.bottom) / 2 + 5, l.label, { "font-weight": 900, fill: "var(--ink-3)", "font-size": 13 }));
  });
  const lineYs = [geo.user.bottom + 6, geo.lanes[0].bottom + 6, geo.lanes[1].bottom + 6];
  lineYs.forEach((y, i) => {
    const strong = i === 1;
    root.appendChild(svg("line", { x1: BP.LABEL_W, x2: width - 10, y1: y, y2: y, stroke: strong ? "var(--ink)" : "var(--ink-3)", "stroke-width": strong ? 2 : 1.2, "stroke-dasharray": strong ? "10 5" : "4 4" }));
    root.appendChild(txt(BP.LABEL_W + 4, y - 4, BP_LINES[i], { "font-size": 11, "font-weight": strong ? 900 : 500, fill: strong ? "var(--ink)" : "var(--ink-3)" }));
  });
};

const drawStep = (ctx, root, step, i, geo) => {
  const cx = BP.LABEL_W + BP.COL_W * (i + 0.5);
  const style = STEP_STYLE[step.status];
  const group = svg("g", { class: "bp-step", "data-step": step.step, opacity: step.slice === "later" ? 0.5 : 1 });
  const positions = new Map();
  geo.lanes.forEach((lane) => {
    const ids = step.lanes[lane.key];
    const center = (lane.top + lane.bottom) / 2;
    const total = ids.length * BP.CHIP_H + Math.max(0, ids.length - 1) * BP.CHIP_GAP;
    ids.forEach((id, j) => positions.set(id, center - total / 2 + BP.CHIP_H / 2 + j * (BP.CHIP_H + BP.CHIP_GAP)));
    if (step.status === "gap") {
      group.appendChild(svg("rect", { x: cx - BP.CHIP_W / 2, y: center - BP.CHIP_H / 2, width: BP.CHIP_W, height: BP.CHIP_H, rx: 7, fill: "none", stroke: "var(--blocked)", "stroke-dasharray": "4 4" }));
      group.appendChild(txt(cx, center + 4, "?", { "text-anchor": "middle", "font-weight": 900, fill: "var(--blocked)" }));
    }
  });
  const userY = (geo.user.top + geo.user.bottom) / 2;
  if (step.root && positions.has(step.root)) {
    group.appendChild(svg("line", { x1: cx, x2: cx, y1: positions.get(step.root), y2: userY + 22, stroke: "var(--break)", "stroke-width": 3, class: "pulse" }));
  }
  positions.forEach((y, id) => {
    const n = ctx.node(id);
    const meta = STATE_META[n.state];
    group.appendChild(svg("g", { class: "node", "data-jump": id, tabindex: 0, role: "button", "aria-label": `${n.name}，${meta.label}`, transform: `translate(${cx - BP.CHIP_W / 2},${y - BP.CHIP_H / 2})` }, [
      svg("title", {}, [n.name]),
      svg("rect", { width: BP.CHIP_W, height: BP.CHIP_H, rx: 7, fill: meta.tint, stroke: meta.color, "stroke-width": 2, "stroke-dasharray": meta.dashed ? "5 4" : null }),
      txt(BP.CHIP_W / 2, 17, clip(n.name, 10), { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)" }),
    ]));
  });
  group.appendChild(svg("rect", { x: cx - 80, y: userY - 22, width: 160, height: 44, rx: 10, fill: "var(--ink)" }));
  group.appendChild(txt(cx, userY + 5, `${i + 1}. ${clip(step.step, 8)}`, { "text-anchor": "middle", "font-size": 14, "font-weight": 900, fill: "var(--card)" }));
  group.appendChild(txt(cx, geo.verdictY, style.verdict(step.root ? ctx.node(step.root).name : "上游未生效"), { "text-anchor": "middle", "font-weight": 900, fill: style.color, "font-size": 13 }));
  root.appendChild(group);
  return { cx, cy: BP.CURVE_TOP + 8 + style.y * (BP.CURVE_H - 16), status: step.status };
};

const drawCurve = (root, points) => {
  root.appendChild(svg("path", { d: points.map((p, i) => `${i ? "L" : "M"}${p.cx},${p.cy}`).join(" "), fill: "none", stroke: "var(--ink-3)", "stroke-width": 2 }));
  points.forEach((p) => {
    const color = STEP_STYLE[p.status].color;
    root.appendChild(svg("circle", { cx: p.cx, cy: p.cy, r: 8, fill: p.status === "gap" ? "var(--card)" : color, stroke: color, "stroke-width": 2.5 }));
  });
};

const drawSlice = (root, bp, geo, width) => {
  const first = bp.steps.findIndex((s) => s.slice === "later");
  if (first < 0) return;
  const x = BP.LABEL_W + BP.COL_W * first;
  root.appendChild(svg("line", { x1: x, x2: x, y1: 8, y2: geo.height - 20, stroke: "var(--doing)", "stroke-width": 2, "stroke-dasharray": "8 5" }));
  root.appendChild(txt(x + 8, 16, "切线 → 以后再做", { "font-size": 11, "font-weight": 700, fill: "var(--doing)" }));
};

const renderBlueprints = (ctx) => {
  const root = document.getElementById("blueprints");
  if (!ctx.data.blueprints.length) {
    root.replaceChildren(el("div", { class: "card" }, [emptyState("还没有旅程：在目标下写 journey（步骤 → 功能节点）即可生成蓝图。")]));
    return;
  }
  root.replaceChildren(...ctx.data.blueprints.map((bp) => {
    const goal = ctx.data.goals.find((g) => g.id === bp.goal);
    const geo = laneGeometry(bp);
    const width = BP.LABEL_W + bp.steps.length * BP.COL_W + 10;
    const chart = svg("svg", { class: "bp", viewBox: `0 0 ${width} ${geo.height}`, role: "img", "aria-label": `${bp.goal} 旅程蓝图`, style: `min-width:${Math.min(width, 860)}px` });
    drawLaneFrame(chart, geo, width);
    const points = bp.steps.map((s, i) => drawStep(ctx, chart, s, i, geo));
    drawCurve(chart, points);
    drawSlice(chart, bp, geo, width);
    chart.appendChild(txt(width / 2, geo.height - 14, `切线以内 ${bp.summary.inScope} 步，用户目前能走通 ${bp.summary.usable} 步`, { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)", "font-size": 13 }));
    return el("div", { class: "card bp-card" }, [el("h3", {}, [`${bp.goal} · ${goal ? goal.name : ""}`]), el("div", { class: "scroll-x" }, [chart])]);
  }));
};
