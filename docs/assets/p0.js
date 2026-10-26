// P0 引擎页：数据流、状态判定、校验规则，以及引擎对示例项目的真实计算结果（window.P0_DEMO）
(() => {
  "use strict";
  const { STATE_META, svg, html, chip, ring } = window.PM;
  const DEMO = window.P0_DEMO;
  // 来自 npm run coverage 的最近一次结果
  const TEST_STATS = { tests: 53, coverage: [["行", 100], ["语句", 98.9], ["分支", 90.7], ["函数", 100]], threshold: 80 };

  const text = (x, y, value, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [value]);
  const box = (x, y, w, h, title, sub, dark = false) => svg("g", { transform: `translate(${x - w / 2},${y - h / 2})` }, [
    svg("rect", { width: w, height: h, rx: 10, fill: dark ? "var(--ink)" : "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
    svg("text", { x: w / 2, y: sub ? h / 2 - 2 : h / 2 + 5, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: dark ? "var(--card)" : "var(--ink)" }, [title]),
    sub ? svg("text", { x: w / 2, y: h / 2 + 15, "text-anchor": "middle", "font-size": 10, "font-family": "var(--font-mono)", fill: dark ? "var(--card)" : "var(--ink-3)" }, [sub]) : null,
  ].filter(Boolean));
  const arrowDefs = (id) => svg("defs", {}, [svg("marker", { id, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink)" })])]);
  const link = (x1, y1, x2, y2, marker) => svg("path", { d: `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`, fill: "none", stroke: "var(--ink)", "stroke-width": 2, "marker-end": `url(#${marker})` });
  const nameOf = (id) => DEMO.nodes.find((n) => n.id === id)?.name ?? id;
  const wan = (tokens) => `${Number((tokens / 10000).toFixed(1))} 万`;

  const renderHero = () => {
    const root = document.getElementById("hero-svg");
    root.appendChild(ring(100, "var(--ok)", 150, "测试全部通过"));
    root.lastChild.setAttribute("x", 20);
    root.lastChild.setAttribute("y", 60);
    root.appendChild(text(95, 230, `${TEST_STATS.tests} 个测试全部通过`, { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    const X0 = 240, W = 200;
    TEST_STATS.coverage.forEach(([label, pct], i) => {
      const y = 70 + i * 46;
      root.appendChild(text(X0, y - 8, `${label}覆盖率`, { "font-weight": 700, fill: "var(--ink)" }));
      root.appendChild(svg("rect", { x: X0, y, width: W, height: 16, rx: 8, fill: "var(--paper-2)" }));
      root.appendChild(svg("rect", { x: X0, y, width: (W * pct) / 100, height: 16, rx: 8, fill: "var(--ok)" }));
      root.appendChild(text(X0 + W + 8, y + 13, `${pct}%`, { "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }));
    });
    const tx = X0 + (W * TEST_STATS.threshold) / 100;
    root.appendChild(svg("line", { x1: tx, x2: tx, y1: 52, y2: 220, stroke: "var(--break)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
    root.appendChild(text(tx, 240, `门槛 ${TEST_STATS.threshold}%`, { "text-anchor": "middle", fill: "var(--break)", "font-size": 11, "font-weight": 700 }));
  };

  const renderFlow = () => {
    const root = document.getElementById("flow-svg");
    root.appendChild(arrowDefs("flow-arrow"));
    const inputs = [["pm.yaml", "人 + AI 编写"], ["evidence", "测试运行器"], ["ledger.jsonl", "会话 hook"]];
    const outputs = [["目标 · 推荐", "goals.ts"], ["成本", "cost.ts"], ["旅程蓝图", "blueprint.ts"]];
    const ys = [60, 150, 240];
    inputs.forEach(([t, s], i) => {
      root.appendChild(link(170, ys[i], 236, 150, "flow-arrow"));
      root.appendChild(box(95, ys[i], 150, 52, t, s));
    });
    root.appendChild(box(310, 150, 140, 60, "载入与校验", "load.ts"));
    root.appendChild(link(380, 150, 426, 150, "flow-arrow"));
    root.appendChild(box(500, 150, 140, 60, "评估", "evaluate.ts", true));
    outputs.forEach(([t, s], i) => {
      root.appendChild(link(570, 150, 626, ys[i], "flow-arrow"));
      root.appendChild(link(780, ys[i], 826, 150, "flow-arrow"));
      root.appendChild(box(705, ys[i], 150, 52, t, s));
    });
    root.appendChild(box(900, 150, 130, 60, "analyze()", "一次算完", true));
    root.appendChild(text(900, 205, "→ P1 渲染五视图", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ok)" }));
    root.appendChild(text(310, 200, "非法输入在这里被拒绝", { "text-anchor": "middle", "font-size": 11, fill: "var(--break)" }));
  };

  const diamond = (x, y, label) => svg("g", { transform: `translate(${x},${y})` }, [
    svg("path", { d: "M0,-38 L78,0 L0,38 L-78,0 Z", fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
    svg("text", { x: 0, y: 5, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "var(--ink)" }, [label]),
  ]);
  const outcome = (x, y, state) => {
    const meta = STATE_META[state];
    return svg("g", { transform: `translate(${x - 56},${y - 18})` }, [
      svg("rect", { width: 112, height: 36, rx: 9, fill: meta.tint, stroke: meta.color, "stroke-width": 2.2, "stroke-dasharray": meta.dashed ? "5 4" : "none" }),
      svg("text", { x: 56, y: 23, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: meta.color }, [meta.label]),
    ]);
  };
  const renderDecide = () => {
    const root = document.getElementById("decide-svg");
    root.appendChild(arrowDefs("dec-arrow"));
    const Y = 80, OUT_Y = 200;
    const steps = [[110, "有验收测试？", "todo"], [330, "全部通过？", "doing"], [550, "硬依赖都生效？", "blocked"], [770, "映射组都满足？", "blocked"]];
    steps.forEach(([x, label, out], i) => {
      root.appendChild(svg("line", { x1: x, y1: Y + 38, x2: x, y2: OUT_Y - 24, stroke: "var(--break)", "stroke-width": 2, "marker-end": "url(#dec-arrow)" }));
      root.appendChild(text(x + 8, Y + 64, "否", { fill: "var(--break)", "font-weight": 700 }));
      if (i < steps.length - 1) {
        root.appendChild(svg("line", { x1: x + 78, y1: Y, x2: steps[i + 1][0] - 84, y2: Y, stroke: "var(--ok)", "stroke-width": 2, "marker-end": "url(#dec-arrow)" }));
        root.appendChild(text(x + 100, Y - 8, "是", { fill: "var(--ok)", "font-weight": 700 }));
      }
      root.appendChild(diamond(x, Y, label));
      root.appendChild(outcome(x, OUT_Y, out));
    });
    root.appendChild(svg("line", { x1: 848, y1: Y, x2: 880, y2: Y, stroke: "var(--ok)", "stroke-width": 2, "marker-end": "url(#dec-arrow)" }));
    root.appendChild(text(856, Y - 8, "是", { fill: "var(--ok)", "font-weight": 700 }));
    root.appendChild(outcome(940, Y, "ok"));
    root.appendChild(text(330, 238, "没跑过 / 用例数为 0 也算进行中", { "text-anchor": "middle", "font-size": 11 }));
    root.appendChild(text(770, 238, "any 组：任一目标生效即可", { "text-anchor": "middle", "font-size": 11 }));
  };

  const GLYPHS = {
    schema: () => [svg("path", { d: "M14,6 C6,6 10,20 4,20 C10,20 6,34 14,34 M30,6 C38,6 34,20 40,20 C34,20 38,34 30,34", fill: "none", stroke: "var(--ink)", "stroke-width": 2.5 })],
    dup: () => [svg("rect", { x: 4, y: 6, width: 22, height: 22, rx: 4, fill: "none", stroke: "var(--ink)", "stroke-width": 2.5 }), svg("rect", { x: 16, y: 14, width: 22, height: 22, rx: 4, fill: "var(--break)", opacity: 0.8 })],
    crossDep: () => [svg("path", { d: "M2,10 h40 M2,32 h40", stroke: "var(--ink-3)", "stroke-width": 2 }), svg("path", { d: "M14,10 L30,32", stroke: "var(--break)", "stroke-width": 3 }), svg("path", { d: "M15,16 l12,10 M27,16 l-12,10", stroke: "var(--break)", "stroke-width": 2.5 })],
    direction: () => [svg("circle", { cx: 8, cy: 8, r: 5, fill: "var(--ink)" }), svg("circle", { cx: 22, cy: 21, r: 5, fill: "var(--ink)" }), svg("circle", { cx: 36, cy: 34, r: 5, fill: "var(--ink)" }), svg("path", { d: "M12,11 L18,17 M26,24 L32,30", stroke: "var(--ok)", "stroke-width": 3 })],
    missing: () => [svg("rect", { x: 6, y: 6, width: 32, height: 30, rx: 6, fill: "none", stroke: "var(--blocked)", "stroke-width": 2.5, "stroke-dasharray": "5 4" }), svg("text", { x: 22, y: 28, "text-anchor": "middle", "font-size": 18, "font-weight": 900, fill: "var(--blocked)" }, ["?"])],
    journey: () => [svg("path", { d: "M4,30 C14,10 28,34 40,12", fill: "none", stroke: "var(--ink)", "stroke-width": 2.5, "stroke-dasharray": "4 4" }), svg("circle", { cx: 40, cy: 12, r: 5, fill: "var(--ok)" })],
    cycle: () => [svg("path", { d: "M34,14 A14,14 0 1,0 36,26", fill: "none", stroke: "var(--break)", "stroke-width": 3 }), svg("path", { d: "M28,8 L35,14 L27,19", fill: "none", stroke: "var(--break)", "stroke-width": 3 })],
    limit: () => Array.from({ length: 16 }, (_, i) => svg("circle", { cx: 7 + (i % 4) * 10, cy: 7 + Math.floor(i / 4) * 10, r: 3.5, fill: i > 12 ? "var(--blocked)" : "var(--ink-3)" })),
  };
  const RULES = [
    ["schema", "字段与类型", "缺字段、类型错都报出路径，如 views.logical.0.layer"],
    ["dup", "id 全局唯一", "节点 id 跨视图唯一；目标 id 唯一；同一节点同类映射只能一条"],
    ["crossDep", "依赖不跨视图", "depends 只能指向本视图；跨视图关系必须用 mappings"],
    ["direction", "映射方向", "realized_by：功能 → 逻辑；deployed_on：逻辑 → 物理"],
    ["missing", "引用必须存在", "映射目标、目标的 requires 都要指向存在的节点"],
    ["journey", "旅程指向功能", "journey 的每一步都必须指向功能节点"],
    ["cycle", "不能有环", "依赖（含软依赖）与映射合起来无环，有环报出环路"],
    ["limit", "40 个节点上限", "单个视图超过上限只警告，提示分层折叠"],
  ];
  const renderRules = () => {
    const root = document.getElementById("rules");
    RULES.forEach(([glyph, title, desc]) => root.appendChild(html("article", { class: "card rule" }, [
      svg("svg", { viewBox: "0 0 44 42", width: 44, height: 42 }, GLYPHS[glyph]()),
      html("b", {}, [title]), html("small", {}, [desc]),
    ])));
  };

  const renderNodes = () => {
    const root = document.getElementById("nodes-svg");
    const W = 112, H = 34, GAP = 10, X0 = 110, PER_ROW = 7;
    const rows = ["functional", "logical", "physical"].flatMap((view) => {
      const list = DEMO.nodes.filter((n) => n.view === view);
      return Array.from({ length: Math.ceil(list.length / PER_ROW) }, (_, r) => ({ view, list: list.slice(r * PER_ROW, (r + 1) * PER_ROW), first: r === 0 }));
    });
    const LABEL = { functional: "功能", logical: "逻辑", physical: "物理" };
    rows.forEach((row, r) => {
      const y = 20 + r * 56;
      if (row.first) root.appendChild(text(10, y + 22, `${LABEL[row.view]}视图`, { "font-weight": 900, fill: "var(--ink-3)", "font-size": 13 }));
      row.list.forEach((n, i) => {
        const meta = STATE_META[n.state];
        const x = X0 + i * (W + GAP);
        root.appendChild(svg("g", { transform: `translate(${x},${y})` }, [
          svg("rect", { width: W, height: H, rx: 8, fill: meta.tint, stroke: meta.color, "stroke-width": 2, "stroke-dasharray": meta.dashed ? "5 4" : "none" }),
          svg("text", { x: W / 2, y: 22, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: "var(--ink)" }, [n.name]),
          n.crossViewBlocked ? svg("text", { x: W - 4, y: -3, "text-anchor": "end", "font-size": 13, "font-weight": 900, fill: "var(--break)" }, ["⇡"]) : null,
          n.pendingReview ? svg("text", { x: 4, y: -3, "font-size": 12, "font-weight": 900, fill: "var(--doing)" }, ["◆ 待复核"]) : null,
        ].filter(Boolean)));
      });
    });
  };

  const renderRecs = () => {
    const root = document.getElementById("recs-svg");
    const top = DEMO.recommendations.slice(0, 6);
    const max = Math.max(...top.map((r) => r.leverage));
    const LABEL_W = 110, BAR = 300, ROW = 48;
    top.forEach((r, i) => {
      const y = 10 + i * ROW;
      const w = (r.leverage / max) * BAR;
      const goals = r.goalDeltas.map((d) => `${d.goal} +${Math.round((d.after - d.before) * 100)}`).join(" ");
      root.appendChild(text(LABEL_W - 10, y + 17, nameOf(r.target), { "text-anchor": "end", "font-weight": 900, fill: "var(--ink)", "font-size": 13 }));
      root.appendChild(svg("rect", { x: LABEL_W, y: y + 4, width: BAR, height: 18, rx: 5, fill: "var(--paper-2)" }));
      root.appendChild(svg("rect", { x: LABEL_W, y: y + 4, width: w, height: 18, rx: 5, fill: i === 0 ? "var(--ink)" : "var(--ok)" }));
      root.appendChild(text(LABEL_W, y + 38, `${goals} 个百分点 · 解锁 ${r.unblocked.length} 个节点`, { "font-size": 11 }));
      root.appendChild(svg("circle", { cx: LABEL_W + BAR + 50, cy: y + 13, r: 14, fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 1.8 }));
      root.appendChild(text(LABEL_W + BAR + 50, y + 18, String(r.plan.length), { "text-anchor": "middle", "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }));
    });
    root.appendChild(text(110 + 300 + 50, 298, "计划节点数", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-3)" }));
  };

  const renderGoalsAndCost = () => {
    document.getElementById("demo-sub").textContent =
      `${DEMO.project}：${DEMO.metrics.total} 个节点，已完成 ${DEMO.metrics.built} 个，已生效 ${DEMO.metrics.effective} 个。以下全部来自 analyze() 的输出。`;
    const rings = document.getElementById("goal-rings");
    DEMO.goals.forEach((g) => {
      const pct = Math.round(g.ratio * 100);
      const color = pct === 100 ? "var(--ok)" : pct >= 40 ? "var(--blocked)" : "var(--break)";
      rings.appendChild(html("div", {}, [ring(pct, color, 84, `${g.id} 生效进度`), html("div", {}, [html("b", {}, [g.id]), ` ${g.effectiveCount}/${g.total}`])]));
    });
    const c = DEMO.cost;
    const sunkPct = Math.round((c.sunkTokens / c.totalTokens) * 100);
    document.getElementById("cost-box").replaceChildren(
      html("div", { style: "display:flex;gap:14px;align-items:center" }, [
        ring(sunkPct, "var(--blocked)", 84, "沉没成本占比"),
        html("div", { style: "font-size:.86rem" }, [html("b", {}, [`共 ${wan(c.totalTokens)} token`]), html("br"), `${wan(c.sunkTokens)} 花在未生效节点上`]),
      ]),
      html("div", { class: "chips", style: "margin-top:10px" }, c.stuck.map((id) => chip(`卡住预警：${nameOf(id)} ${Math.round(c.nodes[id].days)} 天`, "blocked"))),
    );
  };

  const LANE_LABEL = { front: "前台", back: "后台", support: "支撑" };
  const NAMES_PER_LINE = 2;
  /** 每条泳道每行最多两个名字，超出换行，避免跨列重叠 */
  const laneLines = (step) => ["front", "back", "support"].flatMap((lane) => {
    const names = step.lanes[lane].map(nameOf);
    if (!names.length) return [`${LANE_LABEL[lane]}：—`];
    return Array.from({ length: Math.ceil(names.length / NAMES_PER_LINE) }, (_, i) =>
      `${i ? "　　 " : `${LANE_LABEL[lane]}：`}${names.slice(i * NAMES_PER_LINE, (i + 1) * NAMES_PER_LINE).join("、")}`);
  });

  const renderBlueprint = () => {
    const root = document.getElementById("bp-svg");
    const bp = DEMO.blueprints[0];
    const COL = 1000 / bp.steps.length;
    const COLOR = { ok: "var(--ok)", broken: "var(--break)", gap: "var(--blocked)" };
    const VERDICT = { ok: "可以走通", broken: "断开", gap: "映射缺口" };
    bp.steps.forEach((s, i) => {
      const cx = COL * (i + 0.5);
      const faded = s.slice === "later";
      root.appendChild(svg("g", { opacity: faded ? 0.5 : 1 }, [
        svg("rect", { x: cx - 100, y: 10, width: 200, height: 40, rx: 10, fill: "var(--ink)" }),
        svg("text", { x: cx, y: 36, "text-anchor": "middle", "font-size": 14, "font-weight": 900, fill: "var(--card)" }, [`${i + 1}. ${s.step}${faded ? "（切线外）" : ""}`]),
        ...laneLines(s).map((line, j) => svg("text", { x: cx, y: 74 + j * 18, "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" }, [line])),
        svg("rect", { x: cx - 90, y: 184, width: 180, height: 32, rx: 16, fill: "none", stroke: COLOR[s.status], "stroke-width": 2.2 }),
        svg("text", { x: cx, y: 205, "text-anchor": "middle", "font-size": 12, "font-weight": 900, fill: COLOR[s.status] }, [
          s.root ? `${VERDICT[s.status]}：${nameOf(s.root)}` : VERDICT[s.status],
        ]),
      ]));
    });
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderHero, renderFlow, renderDecide, renderRules, renderNodes, renderRecs, renderGoalsAndCost, renderBlueprint];
})();
