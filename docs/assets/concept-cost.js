// 概念页：视图四 · 成本（时间 × token），只展示投入，不计入进度
(() => {
  "use strict";
  const { MODULES, GOALS, STATE_META, EFFECTIVE, displayState, goalClosure, svg, html, ring } = window.PM;

  const STUCK_DAYS = 5;          // 进行中超过该天数触发卡住预警
  const MAX_DAYS = 7;
  const MAX_KTOKENS = 700;

  const fmtTokens = (k) => `${Number((k / 10).toFixed(k % 10 ? 1 : 0))} 万`;
  const spent = MODULES.filter((m) => m.ktokens > 0);
  const notStarted = MODULES.filter((m) => m.ktokens === 0);
  const sumTokens = (list) => list.reduce((acc, m) => acc + m.ktokens, 0);
  const isStuck = (m) => m.status === "doing" && m.days > STUCK_DAYS;
  const isSunk = (m) => m.ktokens > 0 && !EFFECTIVE.get(m.id);

  const renderCostChart = () => {
    const root = document.getElementById("cost-svg");
    const X0 = 70, X1 = 630, Y0 = 300, Y1 = 24;
    const sx = (d) => X0 + (d / MAX_DAYS) * (X1 - X0);
    const sy = (k) => Y0 - (k / MAX_KTOKENS) * (Y0 - Y1);
    const radius = (k) => 8 + Math.sqrt(k) * 0.9;

    for (let d = 0; d <= MAX_DAYS; d++) {
      root.appendChild(svg("line", { x1: sx(d), x2: sx(d), y1: Y1, y2: Y0, stroke: "var(--line)", "stroke-dasharray": "2 4" }));
      root.appendChild(svg("text", { x: sx(d), y: Y0 + 20, "text-anchor": "middle", "font-size": 12, fill: "var(--ink-3)", "font-family": "var(--font-mono)" }, [`${d}天`]));
    }
    for (let k = 0; k <= MAX_KTOKENS; k += 200) {
      root.appendChild(svg("line", { x1: X0, x2: X1, y1: sy(k), y2: sy(k), stroke: "var(--line)", "stroke-dasharray": "2 4" }));
      root.appendChild(svg("text", { x: X0 - 10, y: sy(k) + 4, "text-anchor": "end", "font-size": 12, fill: "var(--ink-3)", "font-family": "var(--font-mono)" }, [fmtTokens(k)]));
    }
    root.appendChild(svg("rect", { x: sx(STUCK_DAYS), y: Y1, width: X1 - sx(STUCK_DAYS), height: Y0 - Y1, fill: "var(--break)", opacity: 0.06 }));
    root.appendChild(svg("line", { x1: sx(STUCK_DAYS), x2: sx(STUCK_DAYS), y1: Y1, y2: Y0, stroke: "var(--break)", "stroke-width": 1.5, "stroke-dasharray": "6 4" }));
    root.appendChild(svg("text", { x: sx(STUCK_DAYS) + 8, y: Y0 - 10, "font-size": 12, "font-weight": 700, fill: "var(--break)" }, [`${STUCK_DAYS} 天预警线`]));

    [...spent].sort((a, b) => b.ktokens - a.ktokens).forEach((m) => {
      const meta = STATE_META[displayState(m.id, "effective")];
      const cx = sx(m.days), cy = sy(m.ktokens), r = radius(m.ktokens);
      if (isStuck(m)) {
        root.appendChild(svg("circle", { cx, cy, r: r + 8, fill: "none", stroke: "var(--break)", "stroke-width": 2, class: "pulse" }));
      }
      root.appendChild(svg("circle", { cx, cy, r, fill: meta.tint, stroke: meta.color, "stroke-width": 2.4, "stroke-dasharray": meta.dashed ? "5 4" : "none", opacity: 0.92 }));
      const left = cx > X1 - 200;
      root.appendChild(svg("text", { x: left ? cx - r - 6 : cx + r + 6, y: cy + 4, "text-anchor": left ? "end" : "start", "font-size": 12, "font-weight": 700, fill: "var(--ink)" }, [
        `${m.name}${isStuck(m) ? " · 卡住预警" : ""}`,
      ]));
    });

    root.appendChild(svg("text", { x: X0, y: Y0 + 50, "font-size": 12, fill: "var(--ink-3)" }, [
      `尚未投入（${notStarted.length}）：${notStarted.map((m) => m.name).join(" · ")}`,
    ]));
    root.appendChild(svg("text", { x: X1, y: Y0 + 50, "text-anchor": "end", "font-size": 11, fill: "var(--ink-3)" }, ["气泡大小 ∝ token"]));
  };

  const stackedBar = (parts, total) => {
    const W = 280, H = 16;
    let x = 0;
    return svg("svg", { viewBox: `0 0 ${W} ${H}`, style: "width:100%;height:auto;display:block", role: "img", "aria-label": "按状态的 token 分布" },
      parts.map((p) => {
        const w = (p.value / total) * W;
        const node = svg("rect", { x, y: 0, width: Math.max(w - 2, 0), height: H, rx: 4, fill: p.color });
        x += w;
        return node;
      }));
  };

  const renderCostSide = () => {
    const root = document.getElementById("cost-side");
    const total = sumTokens(spent);
    const sunk = sumTokens(spent.filter(isSunk));
    const sunkPct = Math.round((sunk / total) * 100);
    const byState = ["ok", "blocked", "doing"].map((st) => ({
      st, color: STATE_META[st].color,
      value: sumTokens(spent.filter((m) => displayState(m.id, "effective") === st)),
    })).filter((p) => p.value > 0);
    const stuck = MODULES.filter(isStuck);
    const goalRows = GOALS.map((g) => {
      const k = sumTokens(goalClosure(g).map((id) => MODULES.find((m) => m.id === id)));
      return html("div", { style: "display:grid;grid-template-columns:34px 1fr 54px;gap:8px;align-items:center;font-size:.8rem" }, [
        html("b", { class: "mono" }, [g.id]),
        svg("svg", { viewBox: "0 0 100 10", style: "width:100%;height:10px", preserveAspectRatio: "none" }, [
          svg("rect", { width: 100, height: 10, rx: 3, fill: "var(--paper-2)" }),
          svg("rect", { width: (k / total) * 100, height: 10, rx: 3, fill: "var(--ink)" }),
        ]),
        html("span", { class: "mono", style: "text-align:right" }, [fmtTokens(k)]),
      ]);
    });

    root.replaceChildren(
      html("div", {}, [html("div", { class: "kpi-label" }, ["累计消耗 token"]), html("div", { class: "kpi" }, [fmtTokens(total)])]),
      html("div", { style: "display:flex;gap:14px;align-items:center" }, [
        ring(sunkPct, "var(--blocked)", 84, "沉没风险占比"),
        html("div", { style: "font-size:.86rem" }, [html("b", {}, ["沉没风险"]), html("br"), `${fmtTokens(sunk)} 花在尚未生效的模块上`]),
      ]),
      html("div", {}, [
        html("div", { class: "kpi-label" }, ["按生效状态分布"]),
        stackedBar(byState, total),
        html("div", { class: "chips", style: "margin-top:8px" }, byState.map((p) => html("span", { class: `chip ${p.st}` }, [`${STATE_META[p.st].label} ${fmtTokens(p.value)}`]))),
      ]),
      html("div", {}, [html("div", { class: "kpi-label" }, ["按目标（共享模块重复计入）"]), ...goalRows]),
      stuck.length
        ? html("div", { class: "callout" }, [html("b", {}, ["卡住预警："]), stuck.map((m) => `${m.name} 已进行 ${m.days} 天、消耗 ${fmtTokens(m.ktokens)}，仍未通过验收`).join("；")])
        : html("div", { class: "hint" }, ["暂无卡住预警"]),
    );
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderCostChart, renderCostSide];
})();
