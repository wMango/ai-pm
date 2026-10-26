// 概念页：Hero、状态卡、架构地图、阻塞链、目标、杠杆、What-if、运作机制
(() => {
  "use strict";
  const {
    LAYERS, COL, MODULES, GOALS, NODE_W, NODE_H, STATE_META,
    byId, upstream, downstream, EFFECTIVE, displayState, rootBlockers,
    goalProgress, goalsOf, leverage, whatIf, svg, html, chip, posOf, nodeGlyph, ring,
  } = window.PM;

  // ---------- Hero 图 ----------
  const renderHero = () => {
    const root = document.getElementById("hero-svg");
    const X0 = 50, X1 = 500, Y0 = 250, Y1 = 30;
    const years = ["2023", "2024", "2025", "2026", "2027"];
    const xs = years.map((_, i) => X0 + (i * (X1 - X0)) / (years.length - 1));
    const scale = [0.06, 0.13, 0.3, 0.6, 1].map((v) => Y0 - v * (Y0 - Y1));
    const human = [0.22, 0.23, 0.23, 0.24, 0.24].map((v) => Y0 - v * (Y0 - Y1));
    const line = (ys) => ys.map((y, i) => `${i ? "L" : "M"}${xs[i]},${y}`).join(" ");
    const gap = `${line(scale)} L${xs[4]},${human[4]} ${xs.slice().reverse().map((x, i) => `L${x},${human[4 - i]}`).join(" ")} Z`;
    [
      ...[0, 1, 2, 3].map((i) => svg("line", { x1: X0, x2: X1, y1: Y1 + i * 55, y2: Y1 + i * 55, stroke: "var(--line)", "stroke-dasharray": "2 4" })),
      svg("line", { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: "var(--ink-3)" }),
      svg("path", { d: gap, fill: "var(--break)", opacity: 0.12 }),
      svg("path", { d: line(human), fill: "none", stroke: "var(--ink-3)", "stroke-width": 3, "stroke-dasharray": "7 5" }),
      svg("path", { d: line(scale), fill: "none", stroke: "var(--ink)", "stroke-width": 3.5 }),
      ...xs.map((x, i) => svg("circle", { cx: x, cy: scale[i], r: 5, fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 2.5 })),
      ...xs.map((x, i) => svg("text", { x, y: Y0 + 22, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-3)", "font-family": "var(--font-mono)" }, [years[i]])),
      svg("text", { x: xs[4] - 6, y: scale[4] - 12, "text-anchor": "end", "font-size": 13, "font-weight": 700, fill: "var(--ink)" }, ["AI 可交付的项目规模"]),
      svg("text", { x: xs[4] - 6, y: human[4] + 22, "text-anchor": "end", "font-size": 13, fill: "var(--ink-2)" }, ["人的管理带宽"]),
      svg("text", { x: xs[3] - 20, y: (scale[3] + human[3]) / 2 + 22, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--break)" }, ["失控区"]),
    ].forEach((n) => root.appendChild(n));
  };

  // ---------- 状态卡 + 双环 ----------
  const renderStates = () => {
    const root = document.getElementById("states");
    ["todo", "doing", "blocked", "ok"].forEach((s) => {
      const meta = STATE_META[s];
      root.appendChild(html("div", { class: "card state" }, [nodeGlyph(s), html("b", {}, [meta.label]), html("small", {}, [meta.desc])]));
    });
    const total = MODULES.length;
    const built = MODULES.filter((m) => m.status === "done").length;
    const eff = [...EFFECTIVE.values()].filter(Boolean).length;
    const pct = (n) => Math.round((n / total) * 100);
    const cap = (title, text) => html("div", { class: "ring-cap" }, [html("b", {}, [title]), text]);
    const wrap = (r, c) => html("div", {}, [r, c]);
    root.appendChild(html("div", { class: "card rings" }, [
      wrap(ring(pct(built), "var(--ink)", 96, "建成度"), cap("建成度", `${built}/${total} 已完成`)),
      wrap(ring(pct(eff), "var(--ok)", 96, "生效度"), cap("生效度", `${eff}/${total} 真正可用`)),
    ]));
  };

  // ---------- 架构地图 ----------
  const mapState = { mode: "effective", selected: null };

  const edgePath = (from, to) => {
    const a = posOf(from), b = posOf(to);
    if (Math.abs(a.y - b.y) < 1) {
      const dir = b.x > a.x ? 1 : -1;
      return `M${a.x + dir * NODE_W / 2},${a.y} L${b.x - dir * (NODE_W / 2 + 6)},${b.y}`;
    }
    const sy = a.y + NODE_H / 2, ty = b.y - NODE_H / 2 - 6, my = (sy + ty) / 2;
    return `M${a.x},${sy} C${a.x},${my} ${b.x},${my} ${b.x},${ty}`;
  };

  const renderMap = () => {
    const root = document.getElementById("map-svg");
    root.replaceChildren();
    const { mode, selected } = mapState;
    const focus = selected ? new Set([...upstream(selected), ...downstream(selected)]) : null;

    root.appendChild(svg("defs", {}, ["ok", "break", "muted"].map((k) =>
      svg("marker", { id: `arrow-${k}`, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, [
        svg("path", { d: "M0,0 L10,5 L0,10 z", fill: k === "ok" ? "var(--ok)" : k === "break" ? "var(--break)" : "var(--ink-3)" }),
      ]))));

    LAYERS.forEach((l, i) => {
      root.appendChild(svg("rect", { x: 0, y: l.y - 56, width: 1060, height: 112, fill: i % 2 ? "transparent" : "var(--paper-2)", opacity: 0.55, rx: 10 }));
      root.appendChild(svg("text", { x: 24, y: l.y + 5, "font-size": 13, "font-weight": 700, fill: "var(--ink-3)", "letter-spacing": "2" }, [l.name]));
    });

    MODULES.forEach((m) => m.deps.forEach((d) => {
      const target = byId.get(d);
      const broken = mode === "effective" && !EFFECTIVE.get(d);
      const muted = mode === "built";
      const isDim = focus && !(focus.has(m.id) && focus.has(d));
      root.appendChild(svg("path", {
        d: edgePath(m, target), fill: "none",
        stroke: muted ? "var(--ink-3)" : broken ? "var(--break)" : "var(--ok)",
        "stroke-width": broken ? 2.4 : 2, "stroke-dasharray": broken ? "6 5" : "none",
        "marker-end": `url(#arrow-${muted ? "muted" : broken ? "break" : "ok"})`,
        class: `edge${broken ? " pulse" : ""}${isDim ? " dim" : ""}`,
      }));
    }));

    MODULES.forEach((m) => {
      const { x, y } = posOf(m);
      const state = displayState(m.id, mode);
      const meta = STATE_META[state];
      const isSel = m.id === selected;
      const g = svg("g", {
        class: `node${focus && !focus.has(m.id) ? " dim" : ""}`, tabindex: 0, role: "button",
        "aria-label": `${m.name}，${meta.label}`, "data-id": m.id,
        transform: `translate(${x - NODE_W / 2},${y - NODE_H / 2})`,
      }, [
        isSel ? svg("rect", { x: -6, y: -6, width: NODE_W + 12, height: NODE_H + 12, rx: 14, fill: "none", stroke: "var(--ink)", "stroke-width": 1.5, "stroke-dasharray": "3 3" }) : null,
        svg("rect", { class: "body", width: NODE_W, height: NODE_H, rx: 9, fill: meta.tint, stroke: meta.color, "stroke-width": 2.2, "stroke-dasharray": meta.dashed ? "6 4" : "none" }),
        svg("rect", { width: 8, height: NODE_H, rx: 4, fill: meta.color, opacity: meta.dashed ? 0.4 : 1 }),
        svg("text", { x: NODE_W / 2 + 4, y: NODE_H / 2 + 5, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "var(--ink)" }, [m.name]),
        state === "blocked" ? svg("g", { transform: `translate(${NODE_W - 8},-8)` }, [
          svg("circle", { r: 10, fill: "var(--break)" }),
          svg("path", { d: "M-4,-4 L4,4 M4,-4 L-4,4", stroke: "#fff", "stroke-width": 2.4, "stroke-linecap": "round" }),
        ]) : null,
      ].filter(Boolean));
      root.appendChild(g);
    });
    renderPanel();
  };

  const renderPanel = () => {
    const root = document.getElementById("panel");
    const id = mapState.selected;
    if (!id) {
      root.replaceChildren(html("h3", {}, ["点击模块"]), html("p", { class: "hint" }, ["查看它的依赖、根因阻塞与影响的目标。"]));
      return;
    }
    const m = byId.get(id);
    const state = displayState(id, "effective");
    const kind = (x) => displayState(x, "effective");
    const blockers = rootBlockers(id);
    const deps = m.deps.map((d) => chip(byId.get(d).name, kind(d)));
    const down = [...downstream(id)].filter((x) => x !== id).map((x) => chip(byId.get(x).name, kind(x)));
    const goals = goalsOf(id).map((g) => chip(g.id, "goal-tag"));
    const dash = () => html("span", { class: "hint" }, ["—"]);
    root.replaceChildren(
      html("div", {}, [html("div", { class: "eyebrow" }, [LAYERS.find((l) => l.id === m.layer).name]), html("h3", {}, [m.name])]),
      html("div", { class: "chips" }, [chip(STATE_META[state].label, state)]),
      html("dl", { class: "kv" }, [
        html("dt", {}, ["依赖"]), html("dd", {}, [html("div", { class: "chips" }, deps.length ? deps : [dash()])]),
        html("dt", {}, ["影响"]), html("dd", {}, [html("div", { class: "chips" }, down.length ? down : [dash()])]),
        html("dt", {}, ["目标"]), html("dd", {}, [html("div", { class: "chips" }, goals.length ? goals : [dash()])]),
      ]),
      blockers.length
        ? html("div", { class: "callout" }, [html("b", {}, ["根因阻塞："]), blockers.map((b) => byId.get(b).name).join("、"), m.status === "done" ? "。本模块已写完，但要等它们完成才能生效。" : "。"])
        : html("div", { class: "callout", style: "border-color:var(--ok)" }, ["上游链路畅通。"]),
    );
  };

  const bindMap = () => {
    document.querySelectorAll(".seg button").forEach((btn) => btn.addEventListener("click", () => {
      mapState.mode = btn.dataset.mode;
      document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderMap();
    }));
    const svgRoot = document.getElementById("map-svg");
    const pick = (target) => {
      const g = target.closest(".node");
      mapState.selected = g ? (g.dataset.id === mapState.selected ? null : g.dataset.id) : null;
      renderMap();
      if (g) svgRoot.querySelector(`[data-id="${g.dataset.id}"]`)?.focus();
    };
    svgRoot.addEventListener("click", (e) => pick(e.target));
    svgRoot.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e.target); } });

    const legend = document.getElementById("legend");
    Object.values(STATE_META).forEach((meta) => {
      legend.appendChild(html("span", {}, [html("i", { style: `background:${meta.tint};border-color:${meta.color};border-style:${meta.dashed ? "dashed" : "solid"}` }), meta.label]));
    });
  };

  // ---------- 阻塞传播链 ----------
  const renderChain = () => {
    const root = document.getElementById("chain-svg");
    const W = 150, H = 50;
    const place = { vdb: [90, 115], retr: [300, 115], chatsvc: [530, 60], parse: [530, 170], chatui: [770, 60], kb: [770, 170] };
    const order = Object.keys(place);
    const link = (a, b) => {
      const [ax, ay] = place[a], [bx, by] = place[b];
      const sx = ax + W / 2, tx = bx - W / 2 - 4, mx = (sx + tx) / 2;
      return svg("path", { d: `M${sx},${ay} C${mx},${ay} ${mx},${by} ${tx},${by}`, fill: "none", stroke: "var(--break)", "stroke-width": 3, class: "pulse", "marker-end": "url(#chain-arrow)" });
    };
    root.appendChild(svg("defs", {}, [svg("marker", { id: "chain-arrow", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--break)" })])]));
    [["vdb", "retr"], ["retr", "chatsvc"], ["retr", "parse"], ["chatsvc", "chatui"], ["parse", "kb"]].forEach(([a, b]) => root.appendChild(link(a, b)));
    root.appendChild(svg("rect", { x: 10, y: 75, width: 370, height: 80, rx: 14, fill: "var(--break)", opacity: 0.07 }));
    root.appendChild(svg("text", { x: 195, y: 24 + 175 + 24, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--break)" }, ["根因：2 个未建模块"]));
    root.appendChild(svg("text", { x: 650, y: 24 + 175 + 24, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--blocked)" }, ["结果：3 个已完成模块 + 1 个进行中模块无法生效"]));
    order.forEach((id) => {
      const [x, y] = place[id];
      const state = displayState(id, "effective");
      const meta = STATE_META[state];
      root.appendChild(svg("g", { transform: `translate(${x - W / 2},${y - H / 2})` }, [
        svg("rect", { width: W, height: H, rx: 10, fill: meta.tint, stroke: meta.color, "stroke-width": 2.4, "stroke-dasharray": meta.dashed ? "6 4" : "none" }),
        svg("text", { x: W / 2, y: 22, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "var(--ink)" }, [byId.get(id).name]),
        svg("text", { x: W / 2, y: 40, "text-anchor": "middle", "font-size": 11, fill: meta.color, "font-weight": 700 }, [meta.label]),
      ]));
    });
  };

  // ---------- 目标卡 ----------
  const renderGoals = () => {
    const root = document.getElementById("goals");
    GOALS.forEach((g) => {
      const { nodes, okCount, pct } = goalProgress(g, EFFECTIVE);
      const toBuild = nodes.filter((x) => byId.get(x).status !== "done");
      const stuck = nodes.filter((x) => byId.get(x).status === "done" && !EFFECTIVE.get(x));
      const color = pct === 100 ? "var(--ok)" : pct >= 40 ? "var(--blocked)" : "var(--break)";
      const row = (label, ids, emptyText) => html("div", {}, [
        html("div", { class: "row-label" }, [label]),
        html("div", { class: "chips" }, ids.length ? ids.map((x) => chip(byId.get(x).name, displayState(x, "effective"))) : [html("span", { class: "hint" }, [emptyText])]),
      ]);
      root.appendChild(html("article", { class: `card goal${pct === 100 ? " done" : ""}` }, [
        html("div", { class: "goal-top" }, [
          ring(pct, color, 84, `${g.id} 生效进度`),
          html("div", {}, [html("div", { class: "goal-id" }, [`${g.id} · ${okCount}/${nodes.length} 生效`]), html("h3", {}, [g.name])]),
        ]),
        row("还要建", toBuild, "无"),
        row("已建但被卡住", stuck, "无"),
      ]));
    });
  };

  // ---------- 杠杆条形图 ----------
  const renderLever = () => {
    const root = document.getElementById("lever-svg");
    const rows = leverage();
    const max = Math.max(...rows.map((r) => r.unblock), 1);
    const LABEL_W = 120, BAR_MAX = 300, ROW_H = 42;
    rows.forEach((r, i) => {
      const y = 12 + i * ROW_H;
      const w = Math.max(6, (r.unblock / max) * BAR_MAX);
      const meta = STATE_META[r.m.status];
      root.appendChild(svg("text", { x: LABEL_W - 10, y: y + 19, "text-anchor": "end", "font-size": 14, "font-weight": 700, fill: "var(--ink)" }, [r.m.name]));
      root.appendChild(svg("rect", { x: LABEL_W, y: y + 4, width: BAR_MAX, height: 22, rx: 5, fill: "var(--paper-2)" }));
      root.appendChild(svg("rect", { x: LABEL_W, y: y + 4, width: w, height: 22, rx: 5, fill: i === 0 ? "var(--ink)" : meta.color, opacity: i === 0 ? 1 : 0.75 }));
      root.appendChild(svg("text", { x: LABEL_W + w + 8, y: y + 20, "font-size": 13, "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }, [String(r.unblock)]));
      r.goals.forEach((g, j) => {
        const gx = LABEL_W + BAR_MAX + 40 + j * 40;
        root.appendChild(svg("rect", { x: gx, y: y + 4, width: 34, height: 22, rx: 11, fill: "none", stroke: "var(--ink)", "stroke-width": 1.5 }));
        root.appendChild(svg("text", { x: gx + 17, y: y + 19, "text-anchor": "middle", "font-size": 11, "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }, [g.id]));
      });
    });
  };

  // ---------- What-if ----------
  const renderWhatIf = () => {
    const root = document.getElementById("whatif");
    const plan = ["vdb", "retr"];
    const after = whatIf(plan);
    const g1 = GOALS[0];
    const before = goalProgress(g1, EFFECTIVE).pct;
    const next = goalProgress(g1, after).pct;
    const freed = MODULES.filter((m) => m.status === "done" && !EFFECTIVE.get(m.id) && after.get(m.id)).map((m) => m.name);
    const W = 300, H = 120, bx = (v) => 20 + (v / 100) * (W - 40);
    const bar = svg("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;height:auto;display:block", role: "img", "aria-label": `G1 从 ${before}% 到 ${next}%` }, [
      svg("rect", { x: 20, y: 40, width: W - 40, height: 26, rx: 13, fill: "rgba(255,255,255,.12)" }),
      svg("rect", { x: 20, y: 40, width: bx(next) - 20, height: 26, rx: 13, fill: "var(--ok)" }),
      svg("rect", { x: 20, y: 40, width: bx(before) - 20, height: 26, rx: 13, fill: "var(--blocked)" }),
      svg("text", { x: bx(before), y: 30, "text-anchor": "middle", "font-size": 13, "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--blocked)" }, [`${before}%`]),
      svg("text", { x: bx(next), y: 30, "text-anchor": "middle", "font-size": 13, "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ok)" }, [`${next}%`]),
      svg("text", { x: 20, y: 92, "font-size": 12, fill: "currentColor", opacity: 0.7 }, ["现在"]),
      svg("text", { x: W - 20, y: 92, "text-anchor": "end", "font-size": 12, fill: "currentColor", opacity: 0.7 }, ["做完之后"]),
    ]);
    root.replaceChildren(
      html("div", { class: "eyebrow", style: "color:inherit;opacity:.6" }, ["推荐下一步 · What-if"]),
      html("h3", {}, [plan.map((p) => byId.get(p).name).join(" → ")]),
      html("p", {}, [`完成后 ${freed.length} 个已写好的模块立即生效：${freed.join("、")}。${g1.id} 生效进度：`]),
      bar,
    );
  };

  // ---------- 运作机制 ----------
  const renderPipe = () => {
    const root = document.getElementById("pipe-svg");
    const steps = [
      { t: "代码仓库", s: "源码 + 验收测试", icon: "M-18,-10 h12 l4,5 h20 v20 h-36 z" },
      { t: "AI 验收", s: "运行测试 · 判定状态", icon: "M0,-18 L5,-5 L18,0 L5,5 L0,18 L-5,5 L-18,0 L-5,-5 Z" },
      { t: "pm.yaml", s: "模块 · 依赖 · 目标", icon: "M-13,-17 h18 l8,8 v26 h-26 z M-7,-4 h14 M-7,3 h14 M-7,10 h9" },
      { t: "计算引擎", s: "生效 · 缺口 · 杠杆", icon: "M-16,0 a16,16 0 1,0 32,0 a16,16 0 1,0 -32,0 M-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0" },
      { t: "五视图", s: "架构 · 目标 · 成本 · 蓝图", icon: "M-16,-12 h12 v10 h-12 z M4,-12 h12 v10 h-12 z M-6,6 h12 v10 h-12 z M-10,-2 L0,6 M10,-2 L0,6" },
    ];
    const xs = steps.map((_, i) => 100 + i * 200), cy = 80;
    root.appendChild(svg("defs", {}, [svg("marker", { id: "pipe-arrow", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink)" })])]));
    xs.slice(0, -1).forEach((x, i) => root.appendChild(svg("line", { x1: x + 48, y1: cy, x2: xs[i + 1] - 54, y2: cy, stroke: "var(--ink)", "stroke-width": 2.5, "marker-end": "url(#pipe-arrow)" })));
    root.appendChild(svg("path", { d: `M${xs[4]},${cy + 80} C${xs[4]},${cy + 128} ${xs[1]},${cy + 128} ${xs[1]},${cy + 86}`, fill: "none", stroke: "var(--ok)", "stroke-width": 2.5, "stroke-dasharray": "7 6", "marker-end": "url(#pipe-arrow)" }));
    root.appendChild(svg("text", { x: (xs[1] + xs[4]) / 2, y: cy + 140, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "var(--ok)" }, ["「下一步推荐」反哺给 AI 作为上下文"]));
    steps.forEach((st, i) => {
      const x = xs[i];
      root.appendChild(svg("g", { transform: `translate(${x},${cy})` }, [
        svg("circle", { r: 44, fill: i === 3 ? "var(--ink)" : "var(--paper-2)", stroke: "var(--ink)", "stroke-width": 2.5 }),
        svg("path", { d: st.icon, fill: "none", stroke: i === 3 ? "var(--card)" : "var(--ink)", "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }),
      ]));
      root.appendChild(svg("text", { x, y: 20, "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: "var(--ink)" }, [st.t]));
      root.appendChild(svg("text", { x, y: cy + 66, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" }, [st.s]));
    });
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderHero, renderStates, bindMap, renderMap, renderChain, renderGoals, renderLever, renderWhatIf, renderPipe];
})();
