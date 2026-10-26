// 概念页：设计决策图（D1–D5）
(() => {
  "use strict";
  const {
    LAYERS, COL, MODULES, GOALS, NODE_W, NODE_H, STATE_META,
    byId, upstream, downstream, EFFECTIVE, displayState, rootBlockers,
    goalProgress, goalsOf, leverage, whatIf, svg, html, chip, posOf, nodeGlyph, ring,
  } = window.PM;

  // ---------- 设计决策图 ----------
  const MAX_NODES_PER_VIEW = 40;
  const txt = (x, y, text, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [text]);

  const renderD1 = () => {
    const root = document.getElementById("d1-svg");
    const COLS = 8, GAP = 26, X0 = 34, Y0 = 40;
    for (let i = 0; i < MAX_NODES_PER_VIEW; i++) {
      const m = MODULES[i];
      const meta = m ? STATE_META[displayState(m.id, "effective")] : null;
      root.appendChild(svg("circle", {
        cx: X0 + (i % COLS) * GAP, cy: Y0 + Math.floor(i / COLS) * GAP, r: 9,
        fill: meta ? meta.color : "none", stroke: meta ? meta.color : "var(--ink-3)",
        "stroke-width": 1.5, "stroke-dasharray": meta ? "none" : "2 3", opacity: meta && meta.dashed ? 0.55 : 1,
      }));
    }
    root.appendChild(txt(285, 92, String(MODULES.length), { "text-anchor": "middle", "font-size": 40, "font-weight": 900, fill: "var(--ink)", "font-family": "var(--font-mono)" }));
    root.appendChild(txt(285, 116, `/ ${MAX_NODES_PER_VIEW} 上限`, { "text-anchor": "middle", "font-family": "var(--font-mono)" }));
    root.appendChild(txt(285, 138, "示例项目", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-3)" }));
    root.appendChild(txt(170, 184, "超过 40 个 → 分层折叠，点开看下一层", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)" }));
  };

  const renderD2 = () => {
    const root = document.getElementById("d2-svg");
    root.appendChild(txt(20, 30, "成本", { "font-weight": 900, "font-size": 14, fill: "var(--ink-3)" }));
    [["代码 3,200 行", 120], ["提交 27 次", 84], ["耗时 6 小时", 100]].forEach(([label, w], i) => {
      const y = 46 + i * 34;
      root.appendChild(svg("rect", { x: 20, y, width: w, height: 22, rx: 5, fill: "var(--line)" }));
      root.appendChild(txt(28, y + 15, label, { "font-size": 11, fill: "var(--ink-3)" }));
    });
    root.appendChild(svg("g", { transform: "translate(80,100) rotate(-14)" }, [
      svg("rect", { x: -44, y: -15, width: 88, height: 30, rx: 5, fill: "none", stroke: "var(--break)", "stroke-width": 2.5 }),
      svg("text", { x: 0, y: 6, "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: "var(--break)" }, ["不计入"]),
    ]));
    root.appendChild(svg("line", { x1: 168, y1: 22, x2: 168, y2: 168, stroke: "var(--line)", "stroke-dasharray": "3 4" }));
    root.appendChild(txt(186, 30, "成果 = 验收测试", { "font-weight": 900, "font-size": 14, fill: "var(--ink)" }));
    const results = [true, true, true, true, false, false];
    results.forEach((pass, i) => {
      const x = 186 + i * 24;
      root.appendChild(svg("rect", { x, y: 46, width: 18, height: 18, rx: 4, fill: pass ? "var(--ok)" : "var(--break)" }));
      root.appendChild(svg("path", { d: pass ? `M${x + 4},${55} l4,4 l6,-8` : `M${x + 5},51 l8,8 M${x + 13},51 l-8,8`, stroke: "#fff", "stroke-width": 2, fill: "none", "stroke-linecap": "round" }));
    });
    const passed = results.filter(Boolean).length;
    root.appendChild(txt(186, 86, `${passed} / ${results.length} 通过`, { "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }));
    root.appendChild(svg("path", { d: "M250,94 L250,110", stroke: "var(--ink)", "stroke-width": 2, "marker-end": "url(#pipe-arrow)" }));
    const meta = STATE_META.doing;
    root.appendChild(svg("rect", { x: 196, y: 118, width: 110, height: 34, rx: 8, fill: meta.tint, stroke: meta.color, "stroke-width": 2, "stroke-dasharray": "6 4" }));
    root.appendChild(txt(251, 140, meta.label, { "text-anchor": "middle", "font-weight": 700, fill: meta.color, "font-size": 14 }));
    root.appendChild(txt(170, 186, "全部通过，才算「已完成」", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)" }));
  };

  const renderD3 = () => {
    const root = document.getElementById("d3-svg");
    const planes = [
      { name: "功能", y: 14, xs: [130, 205, 280] },
      { name: "逻辑", y: 76, xs: [110, 165, 220, 275] },
      { name: "物理", y: 138, xs: [140, 215, 290] },
    ];
    const H = 46, NW = 40, NH = 16;
    const center = (p, i) => [planes[p].xs[i], planes[p].y + H / 2];
    // [平面, 节点] → [平面, 节点]：只映射一部分，其余节点独立存在
    const LINKS = [[[0, 0], [1, 0]], [[0, 1], [1, 2]], [[1, 0], [2, 0]], [[1, 2], [2, 1]]];
    const mapped = new Set(LINKS.flat().map(([p, i]) => `${p}-${i}`));
    planes.forEach((pl) => {
      root.appendChild(svg("path", { d: `M44,${pl.y} L330,${pl.y} L300,${pl.y + H} L14,${pl.y + H} Z`, fill: "var(--card)", stroke: "var(--ink-3)", "stroke-width": 1.2 }));
      root.appendChild(txt(46, pl.y + H / 2 + 5, pl.name, { "font-weight": 900, fill: "var(--ink)", "font-size": 13 }));
    });
    LINKS.forEach(([a, b]) => {
      const [x1, y1] = center(...a), [x2, y2] = center(...b);
      root.appendChild(svg("line", { x1, y1: y1 + NH / 2, x2, y2: y2 - NH / 2, stroke: "var(--doing)", "stroke-width": 2, "stroke-dasharray": "4 3" }));
    });
    planes.forEach((pl, p) => pl.xs.forEach((x, i) => {
      const isMapped = mapped.has(`${p}-${i}`);
      root.appendChild(svg("rect", {
        x: x - NW / 2, y: pl.y + H / 2 - NH / 2, width: NW, height: NH, rx: 4,
        fill: isMapped ? "var(--doing-tint)" : "var(--paper-2)", stroke: isMapped ? "var(--doing)" : "var(--ink-3)", "stroke-width": 1.5,
      }));
    }));
    root.appendChild(svg("line", { x1: 196, y1: 194, x2: 214, y2: 194, stroke: "var(--doing)", "stroke-width": 2, "stroke-dasharray": "4 3" }));
    root.appendChild(txt(218, 198, "可选映射", { "font-size": 11 }));
    root.appendChild(svg("rect", { x: 270, y: 188, width: 14, height: 11, rx: 3, fill: "var(--paper-2)", stroke: "var(--ink-3)" }));
    root.appendChild(txt(288, 198, "独立节点", { "font-size": 11 }));
  };

  const renderD4 = () => {
    const root = document.getElementById("d4-svg");
    const W = 150, H = 38;
    const LANES = [{ name: "功能", y: 44 }, { name: "逻辑", y: 118 }, { name: "物理", y: 192 }];
    const NODES = {
      fAsk: { lane: 0, x: 470, name: "基于文档问答", state: "blocked", cross: true },
      fLogin: { lane: 0, x: 800, name: "账号登录", state: "ok" },
      lRetr: { lane: 1, x: 260, name: "向量检索", state: "blocked", cross: true },
      lChat: { lane: 1, x: 470, name: "对话服务", state: "blocked" },
      lAuth: { lane: 1, x: 800, name: "用户认证", state: "ok" },
      pVec: { lane: 2, x: 260, name: "PG 向量实例", state: "fail" },
      pAuth: { lane: 2, x: 800, name: "认证服务器", state: "ok" },
    };
    const at = (k) => ({ x: NODES[k].x, y: LANES[NODES[k].lane].y });
    root.appendChild(svg("defs", {}, [svg("marker", { id: "d4-arrow", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--break)" })])]));
    LANES.forEach((l, i) => {
      root.appendChild(svg("rect", { x: 0, y: l.y - 32, width: 960, height: 64, rx: 10, fill: i % 2 ? "transparent" : "var(--card)", opacity: 0.7 }));
      root.appendChild(txt(22, l.y + 5, `${l.name}视图`, { "font-weight": 900, fill: "var(--ink-3)", "font-size": 13 }));
    });
    const vertical = (from, to, label, broken) => {
      const a = at(from), b = at(to);
      root.appendChild(svg("line", { x1: a.x, y1: a.y - H / 2, x2: b.x, y2: b.y + H / 2 + 6, stroke: broken ? "var(--break)" : "var(--ok)", "stroke-width": 2.6,
        "stroke-dasharray": broken ? "6 5" : "none", class: broken ? "pulse" : "", "marker-end": broken ? "url(#d4-arrow)" : "" }));
      root.appendChild(txt(a.x + 8, (a.y + b.y) / 2 + 4, label, { "font-size": 11, "font-family": "var(--font-mono)", fill: broken ? "var(--break)" : "var(--ink-3)" }));
    };
    vertical("pVec", "lRetr", "deployed_on", true);
    vertical("lChat", "fAsk", "realized_by", true);
    vertical("pAuth", "lAuth", "deployed_on", false);
    vertical("lAuth", "fLogin", "realized_by", false);
    const r = at("lRetr"), c = at("lChat");
    root.appendChild(svg("line", { x1: r.x + W / 2, y1: r.y, x2: c.x - W / 2 - 6, y2: c.y, stroke: "var(--break)", "stroke-width": 2.6, "stroke-dasharray": "6 5", class: "pulse", "marker-end": "url(#d4-arrow)" }));
    Object.values(NODES).forEach((n) => {
      const y = LANES[n.lane].y;
      const meta = n.state === "fail" ? { color: "var(--break)", tint: "var(--paper-2)", label: "健康检查失败", dashed: true } : STATE_META[n.state];
      root.appendChild(svg("g", { transform: `translate(${n.x - W / 2},${y - H / 2})` }, [
        svg("rect", { width: W, height: H, rx: 9, fill: meta.tint, stroke: meta.color, "stroke-width": 2.2, "stroke-dasharray": meta.dashed ? "6 4" : "none" }),
        svg("text", { x: W / 2, y: 17, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--ink)" }, [n.name]),
        svg("text", { x: W / 2, y: 31, "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: meta.color }, [meta.label]),
        n.cross ? svg("g", { transform: `translate(${W - 4},-4)` }, [
          svg("rect", { x: -26, y: -9, width: 40, height: 18, rx: 9, fill: "var(--break)" }),
          svg("text", { x: -6, y: 4, "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: "#fff" }, ["跨视图"]),
        ]) : null,
      ].filter(Boolean)));
    });
    root.appendChild(txt(370, 186, "根因在物理视图：", { "font-size": 12, "font-weight": 700, fill: "var(--break)" }));
    root.appendChild(txt(370, 204, "PG 向量实例 → 向量检索 → 对话服务 → 基于文档问答", { "font-size": 11, fill: "var(--ink-2)" }));
    root.appendChild(txt(800, 230, "映射链路健康，不受影响", { "text-anchor": "middle", "font-size": 11, fill: "var(--ok)", "font-weight": 700 }));
  };

  const renderD5 = () => {
    const root = document.getElementById("d5-svg");
    const W = 108, H = 46;
    const LANE_Y = { human: 62, ai: 172 };
    const STEPS = [
      { lane: "human", x: 140, t: "确认目标", s: "G1 / G2 / G3" },
      { lane: "ai", x: 260, t: "拆模块", s: "起草验收条目" },
      { lane: "human", x: 380, t: "确认功能层", s: "逐条确认 .feature" },
      { lane: "ai", x: 500, t: "生成逻辑/物理", s: "条目 · AI 自签" },
      { lane: "ai", x: 620, t: "锁定指纹", s: "hash 记入 pm.yaml" },
      { lane: "ai", x: 740, t: "生成测试", s: "先跑出失败", test: false },
      { lane: "ai", x: 860, t: "实现代码", s: "测试通过", test: true },
    ];
    const at = (st) => ({ x: st.x, y: LANE_Y[st.lane] });
    root.appendChild(svg("defs", {}, [svg("marker", { id: "d5-arrow", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink)" })])]));
    [["human", "人"], ["ai", "AI"]].forEach(([k, name], i) => {
      root.appendChild(svg("rect", { x: 0, y: LANE_Y[k] - 44, width: 960, height: 88, rx: 10, fill: i ? "transparent" : "var(--card)", opacity: 0.7 }));
      root.appendChild(txt(28, LANE_Y[k] + 6, name, { "font-weight": 900, fill: "var(--ink-3)", "font-size": 16 }));
    });
    STEPS.slice(0, -1).forEach((st, i) => {
      const a = at(st), b = at(STEPS[i + 1]);
      const d = a.y === b.y
        ? `M${a.x + W / 2},${a.y} L${b.x - W / 2 - 6},${b.y}`
        : `M${a.x + W / 2},${a.y} C${a.x + W / 2 + 30},${a.y} ${b.x - W / 2 - 36},${b.y} ${b.x - W / 2 - 6},${b.y}`;
      root.appendChild(svg("path", { d, fill: "none", stroke: "var(--ink)", "stroke-width": 2, "marker-end": "url(#d5-arrow)" }));
    });
    // 测试被改动 → 待复核（人） → 重新锁定
    const review = { x: 800, y: LANE_Y.human };
    root.appendChild(svg("path", { d: `M${860},${LANE_Y.ai - H / 2} C860,120 ${review.x + 30},120 ${review.x + 30},${review.y + H / 2 + 6}`, fill: "none", stroke: "var(--blocked)", "stroke-width": 2.2, "stroke-dasharray": "6 4", "marker-end": "url(#d5-arrow)" }));
    root.appendChild(txt(872, 124, "测试文件被改动", { "font-size": 11, fill: "var(--blocked)", "font-weight": 700 }));
    root.appendChild(svg("path", { d: `M${review.x - W / 2},${review.y} C${640},${review.y} 620,110 620,${LANE_Y.ai - H / 2 - 6}`, fill: "none", stroke: "var(--ok)", "stroke-width": 2.2, "stroke-dasharray": "6 4", "marker-end": "url(#d5-arrow)" }));
    root.appendChild(txt(560, 104, "复核通过 → 重新锁定", { "font-size": 11, fill: "var(--ok)", "font-weight": 700 }));
    root.appendChild(svg("g", { transform: `translate(${review.x - W / 2},${review.y - H / 2})` }, [
      svg("rect", { width: W, height: H, rx: 10, fill: "var(--blocked-tint)", stroke: "var(--blocked)", "stroke-width": 2.2, "stroke-dasharray": "6 4" }),
      svg("text", { x: W / 2, y: 20, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: "var(--blocked)" }, ["待复核"]),
      svg("text", { x: W / 2, y: 36, "text-anchor": "middle", "font-size": 10, fill: "var(--ink-2)" }, ["不阻断 · 人复核"]),
    ]));
    STEPS.forEach((st, i) => {
      const { x, y } = at(st);
      const isHuman = st.lane === "human";
      root.appendChild(svg("g", { transform: `translate(${x - W / 2},${y - H / 2})` }, [
        svg("rect", { width: W, height: H, rx: 10, fill: isHuman ? "var(--ink)" : "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
        svg("text", { x: W / 2, y: 20, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: isHuman ? "var(--card)" : "var(--ink)" }, [st.t]),
        svg("text", { x: W / 2, y: 36, "text-anchor": "middle", "font-size": 10, fill: isHuman ? "var(--card)" : "var(--ink-2)", opacity: 0.85 }, [st.s]),
        svg("circle", { cx: 0, cy: 0, r: 10, fill: "var(--paper)", stroke: "var(--ink)", "stroke-width": 1.5 }),
        svg("text", { x: 0, y: 4, "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "var(--ink)", "font-family": "var(--font-mono)" }, [String(i + 1)]),
        st.test === undefined ? null : svg("rect", { x: W - 14, y: -6, width: 18, height: 12, rx: 3, fill: st.test ? "var(--ok)" : "var(--break)" }),
      ].filter(Boolean)));
    });
    root.appendChild(txt(480, 244, "人只做两件事：定目标、确认功能层验收条目（外加复核被改动的测试）", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)", "font-size": 13 }));
  };

  const renderDecisions = () => { renderD1(); renderD2(); renderD3(); renderD4(); renderD5(); };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderDecisions];
})();
