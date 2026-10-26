// 概念页：视图五 · 旅程蓝图（服务蓝图骨架 + 可用性曲线 + 故事地图切线），由映射自动推出
(() => {
  "use strict";
  const { byId, upstream, EFFECTIVE, STATE_META, displayState, svg } = window.PM;

  // 人只声明：旅程步骤 → 实现它的组件（realized_by）；其余由依赖闭包推出
  const JOURNEY = [
    { step: "登录", realizedBy: ["login"] },
    { step: "上传文档", realizedBy: ["kb"] },
    { step: "提问", realizedBy: ["chatui"] },
    { step: "查看引用", realizedBy: [], slice: "later" },
  ];
  const LANES = [
    { id: "user", name: "用户行为", top: 112, bottom: 188 },
    { id: "front", name: "前台", layers: ["front"], top: 204, bottom: 266 },
    { id: "back", name: "后台", layers: ["service"], top: 290, bottom: 382 },
    { id: "support", name: "支撑系统", layers: ["data", "external"], top: 406, bottom: 498 },
  ];
  const LINES = [
    { y: 196, name: "交互线" },
    { y: 278, name: "可见线 · 用户看不到以下", strong: true },
    { y: 394, name: "内部交互线" },
  ];
  const LABEL_W = 130, X_END = 990;
  const COL_W = (X_END - LABEL_W - 10) / JOURNEY.length;
  const CHIP_W = 140, CHIP_H = 26, CHIP_GAP = 8;
  const CURVE_Y = { ok: 42, gap: 64, broken: 86 };
  const VERDICT_Y = 540;

  const colX = (i) => LABEL_W + 10 + COL_W * (i + 0.5);
  const laneOf = (m) => LANES.find((l) => l.layers && l.layers.includes(m.layer));
  const laneCenter = (l) => (l.top + l.bottom) / 2;

  const analyzeStep = (st) => {
    const ids = new Set(st.realizedBy.flatMap((r) => [...upstream(r)]));
    const nodes = [...ids].map((id) => byId.get(id));
    if (!nodes.length) return { nodes, status: "gap", root: null };
    const blockers = nodes.filter((m) => m.status !== "done");
    const deepest = [...blockers].sort((a, b) => LANES.indexOf(laneOf(b)) - LANES.indexOf(laneOf(a)))[0] || null;
    return { nodes, status: nodes.every((m) => EFFECTIVE.get(m.id)) ? "ok" : "broken", root: deepest };
  };

  const label = (x, y, value, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [value]);

  const drawFrame = (root) => {
    root.appendChild(label(16, CURVE_Y.gap + 4, "可用性曲线", { "font-weight": 900, fill: "var(--ink-3)", "font-size": 13 }));
    LANES.forEach((l, i) => {
      root.appendChild(svg("rect", { x: 0, y: l.top, width: 1000, height: l.bottom - l.top, rx: 8, fill: i % 2 ? "transparent" : "var(--paper-2)", opacity: 0.55 }));
      root.appendChild(label(16, laneCenter(l) + 5, l.name, { "font-weight": 900, fill: "var(--ink-3)", "font-size": 13 }));
    });
    LINES.forEach((ln) => {
      root.appendChild(svg("line", { x1: LABEL_W, x2: X_END, y1: ln.y, y2: ln.y, stroke: ln.strong ? "var(--ink)" : "var(--ink-3)", "stroke-width": ln.strong ? 2 : 1.2, "stroke-dasharray": ln.strong ? "10 5" : "4 4" }));
      root.appendChild(label(LABEL_W + 4, ln.y - 5, ln.name, { "font-size": 11, "font-weight": ln.strong ? 900 : 500, fill: ln.strong ? "var(--ink)" : "var(--ink-3)" }));
    });
  };

  const drawSlice = (root) => {
    const first = JOURNEY.findIndex((st) => st.slice === "later");
    if (first < 0) return;
    const x = colX(first) - COL_W / 2;
    root.appendChild(svg("rect", { x, y: LANES[0].top, width: X_END - x, height: LANES[3].bottom - LANES[0].top, fill: "var(--paper)", opacity: 0.6 }));
    root.appendChild(svg("line", { x1: x, x2: x, y1: 14, y2: VERDICT_Y + 24, stroke: "var(--doing)", "stroke-width": 2, "stroke-dasharray": "8 5" }));
    root.appendChild(label(x + 8, 22, "G1 切线 →  以后再做", { "font-size": 11, "font-weight": 700, fill: "var(--doing)" }));
  };

  const drawCurve = (root, results) => {
    const pts = results.map((r, i) => [colX(i), CURVE_Y[r.status]]);
    root.appendChild(svg("path", { d: pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" "), fill: "none", stroke: "var(--ink-3)", "stroke-width": 2 }));
    const color = { ok: "var(--ok)", broken: "var(--break)", gap: "var(--blocked)" };
    pts.forEach(([x, y], i) => {
      const st = results[i].status;
      root.appendChild(svg("circle", { cx: x, cy: y, r: 9, fill: st === "gap" ? "var(--card)" : color[st], stroke: color[st], "stroke-width": 2.5 }));
      if (st === "gap") root.appendChild(label(x, y + 4, "?", { "text-anchor": "middle", "font-weight": 900, fill: color[st] }));
    });
  };

  const drawChip = (root, m, x, y) => {
    const meta = STATE_META[displayState(m.id, "effective")];
    root.appendChild(svg("g", { transform: `translate(${x - CHIP_W / 2},${y - CHIP_H / 2})` }, [
      svg("rect", { width: CHIP_W, height: CHIP_H, rx: 7, fill: meta.tint, stroke: meta.color, "stroke-width": 2, "stroke-dasharray": meta.dashed ? "5 4" : "none" }),
      svg("rect", { width: 6, height: CHIP_H, rx: 3, fill: meta.color, opacity: meta.dashed ? 0.4 : 1 }),
      svg("text", { x: CHIP_W / 2 + 3, y: 17, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "var(--ink)" }, [m.name]),
    ]));
  };

  const drawColumn = (root, st, res, i) => {
    const cx = colX(i);
    const positions = new Map();
    LANES.slice(1).forEach((lane) => {
      const inLane = res.nodes.filter((m) => laneOf(m) === lane);
      const total = inLane.length * CHIP_H + (inLane.length - 1) * CHIP_GAP;
      inLane.forEach((m, j) => positions.set(m.id, laneCenter(lane) - total / 2 + CHIP_H / 2 + j * (CHIP_H + CHIP_GAP)));
      if (res.status === "gap") {
        root.appendChild(svg("rect", { x: cx - CHIP_W / 2, y: laneCenter(lane) - CHIP_H / 2, width: CHIP_W, height: CHIP_H, rx: 7, fill: "none", stroke: "var(--blocked)", "stroke-width": 1.5, "stroke-dasharray": "4 4" }));
        root.appendChild(label(cx, laneCenter(lane) + 4, lane.id === "front" ? "? 无实现组件" : "?", { "text-anchor": "middle", "font-weight": 700, fill: "var(--blocked)" }));
      }
    });
    const card = laneCenter(LANES[0]);
    if (res.root) {
      root.appendChild(svg("line", { x1: cx, x2: cx, y1: positions.get(res.root.id), y2: card + 22, stroke: "var(--break)", "stroke-width": 3, "stroke-dasharray": "7 5", class: "pulse" }));
    }
    res.nodes.forEach((m) => drawChip(root, m, cx, positions.get(m.id)));
    root.appendChild(svg("g", { transform: `translate(${cx - 76},${card - 22})` }, [
      svg("rect", { width: 152, height: 44, rx: 10, fill: "var(--ink)" }),
      svg("text", { x: 76, y: 28, "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: "var(--card)" }, [`${i + 1}. ${st.step}`]),
    ]));
    const verdict = {
      ok: ["✓ 可以走通", "var(--ok)"],
      broken: [`✗ 断在：${res.root ? res.root.name : "上游未生效"}`, "var(--break)"],
      gap: ["? 映射缺口：没有实现组件", "var(--blocked)"],
    }[res.status];
    root.appendChild(label(cx, VERDICT_Y, verdict[0], { "text-anchor": "middle", "font-weight": 900, fill: verdict[1], "font-size": 13 }));
  };

  const renderBlueprint = () => {
    const root = document.getElementById("blueprint-svg");
    const results = JOURNEY.map(analyzeStep);
    drawFrame(root);
    drawCurve(root, results);
    JOURNEY.forEach((st, i) => drawColumn(root, st, results[i], i));
    drawSlice(root);
    const usable = results.filter((r) => r.status === "ok").length;
    const inScope = JOURNEY.filter((st) => st.slice !== "later").length;
    root.appendChild(label(500, 584, `切线以内 ${inScope} 步，用户目前只能走通 ${usable} 步`, { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)", "font-size": 13 }));
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderBlueprint];
})();
