// 产品形态页：Hero、三件事、生命周期、两种形态、多项目总览、路线
(() => {
  "use strict";
  const { MODULES, GOALS, STATE_META, EFFECTIVE, displayState, goalProgress, whatIf, byId, svg, html, chip, ring } = window.PM;

  const STATE_ORDER = ["ok", "blocked", "doing", "todo"];
  const text = (x, y, value, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [value]);
  const arrowDefs = (id, color = "var(--ink)") => svg("defs", {}, [
    svg("marker", { id, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: color })]),
  ]);

  // 确定性伪随机，保证每次渲染的示意图一致
  const seeded = (seed) => () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- 多项目示意数据（第一个项目来自概念页的真实计算） ----------
  const countStates = () => STATE_ORDER.reduce((acc, st) => ({ ...acc, [st]: MODULES.filter((m) => displayState(m.id, "effective") === st).length }), {});
  const kbPlan = ["vdb", "retr"];
  const kbBefore = goalProgress(GOALS[0], EFFECTIVE).pct;
  const kbAfter = goalProgress(GOALS[0], whatIf(kbPlan)).pct;
  const PROJECTS = [
    { name: "智能知识库问答平台", counts: countStates(), goals: GOALS.map((g) => [g.id, goalProgress(g, EFFECTIVE).pct]), stuck: 1, review: 0, staleDays: 0, tokens: [22, 31, 40, 28, 36, 44, 44] },
    { name: "跨境电商选品工具", counts: { ok: 15, blocked: 1, doing: 3, todo: 2 }, goals: [["G1", 86], ["G2", 60]], stuck: 0, review: 2, staleDays: 0, tokens: [12, 18, 9, 22, 15, 19, 24] },
    { name: "个人记账 App", counts: { ok: 11, blocked: 0, doing: 0, todo: 1 }, goals: [["G1", 100], ["G2", 80]], stuck: 0, review: 0, staleDays: 2, tokens: [8, 4, 2, 3, 1, 0, 2] },
    { name: "内部 BI 看板", counts: { ok: 6, blocked: 11, doing: 2, todo: 11 }, goals: [["G1", 20], ["G2", 35], ["G3", 10]], stuck: 1, review: 1, staleDays: 0, tokens: [30, 42, 51, 38, 47, 55, 60] },
    { name: "播客剪辑助手", counts: { ok: 0, blocked: 1, doing: 0, todo: 8 }, goals: [["G1", 0]], stuck: 0, review: 0, staleDays: 9, tokens: [0, 0, 0, 0, 0, 0, 0] },
  ];
  const totalOf = (p) => STATE_ORDER.reduce((acc, st) => acc + p.counts[st], 0);
  const effPct = (p) => Math.round((p.counts.ok / totalOf(p)) * 100);
  const builtPct = (p) => Math.round(((p.counts.ok + p.counts.blocked) / totalOf(p)) * 100);
  const attention = (p) => p.stuck * 30 + p.review * 20 + (builtPct(p) - effPct(p)) + Math.min(p.staleDays, 14) * 3;

  // ---------- Hero ----------
  const renderHero = () => {
    const root = document.getElementById("hero-svg");
    const CX = 260, CY = 165, BANDWIDTH_R = 74;
    const rand = seeded(7);
    root.appendChild(svg("circle", { cx: CX, cy: CY, r: BANDWIDTH_R, fill: "var(--ok-tint)", stroke: "var(--ok)", "stroke-width": 2, "stroke-dasharray": "6 5" }));
    PROJECTS.forEach((p, i) => {
      const angle = (i / PROJECTS.length) * Math.PI * 2 - Math.PI / 2;
      const px = CX + Math.cos(angle) * 128, py = CY + Math.sin(angle) * 112;
      const states = STATE_ORDER.flatMap((st) => Array(p.counts[st]).fill(st)).slice(0, 14);
      const pts = states.map((st) => ({ st, x: px + (rand() - 0.5) * 92, y: py + (rand() - 0.5) * 62 }));
      pts.slice(1).forEach((pt, j) => root.appendChild(svg("line", { x1: pts[j].x, y1: pts[j].y, x2: pt.x, y2: pt.y, stroke: "var(--line)", "stroke-width": 1 })));
      pts.forEach((pt) => root.appendChild(svg("circle", { cx: pt.x, cy: pt.y, r: 4.5, fill: STATE_META[pt.st].color, opacity: STATE_META[pt.st].dashed ? 0.5 : 0.95 })));
    });
    root.appendChild(svg("g", { transform: `translate(${CX},${CY})` }, [
      svg("circle", { cx: 0, cy: -16, r: 11, fill: "var(--ink)" }),
      svg("path", { d: "M-20,22 C-20,0 20,0 20,22 Z", fill: "var(--ink)" }),
    ]));
    root.appendChild(text(CX, CY + 48, "人的思考带宽", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ok)" }));
    const modules = PROJECTS.reduce((acc, p) => acc + totalOf(p), 0);
    root.appendChild(text(16, 306, `${PROJECTS.length} 个项目 · ${modules} 个模块 —— 早已超出带宽`, { "font-weight": 700, fill: "var(--ink)" }));
  };

  // ---------- 三件事 ----------
  const ICONS = {
    see: [svg("path", { d: "M4,28 C14,12 42,12 52,28 C42,44 14,44 4,28 Z", fill: "none", stroke: "var(--ink)", "stroke-width": 3 }), svg("circle", { cx: 28, cy: 28, r: 8, fill: "var(--ok)" })],
    gap: [svg("circle", { cx: 28, cy: 28, r: 22, fill: "none", stroke: "var(--ink)", "stroke-width": 3 }), svg("circle", { cx: 28, cy: 28, r: 12, fill: "none", stroke: "var(--blocked)", "stroke-width": 3 }), svg("circle", { cx: 28, cy: 28, r: 3.5, fill: "var(--break)" })],
    act: [svg("path", { d: "M6,40 L22,24 L32,32 L50,12", fill: "none", stroke: "var(--ink)", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }), svg("path", { d: "M38,12 L50,12 L50,24", fill: "none", stroke: "var(--ok)", "stroke-width": 3, "stroke-linecap": "round" })],
  };
  const renderTrio = () => {
    const root = document.getElementById("trio");
    [
      ["see", "看清", "每个项目的全貌：哪里已生效、哪里被卡住，一张图看完，不读列表。"],
      ["gap", "找到差距", "离每个目标还差什么；投入的时间和 token 是否花在了刀刃上。"],
      ["act", "更好地行动", "下一步做哪件事对目标推动最大，以及做完之后目标会怎样变化。"],
    ].forEach(([key, title, desc]) => root.appendChild(html("article", { class: "card" }, [
      svg("svg", { viewBox: "0 0 56 56", width: 56, height: 56, style: "flex:none" }, ICONS[key]),
      html("div", {}, [html("h3", {}, [title]), html("p", {}, [desc])]),
    ])));
  };

  // ---------- 生命周期 ----------
  const stationBox = (x, y, title, lines, dark = false) => {
    const W = 186, H = 78;
    return svg("g", { transform: `translate(${x - W / 2},${y - H / 2})` }, [
      svg("rect", { width: W, height: H, rx: 12, fill: dark ? "var(--ink)" : "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
      svg("text", { x: W / 2, y: 24, "text-anchor": "middle", "font-size": 14, "font-weight": 900, fill: dark ? "var(--card)" : "var(--ink)" }, [title]),
      ...lines.map((l, i) => svg("text", { x: W / 2, y: 44 + i * 16, "text-anchor": "middle", "font-size": 11, fill: dark ? "var(--card)" : "var(--ink-2)", opacity: dark ? 0.8 : 1 }, [l])),
    ]);
  };
  const renderLoop = () => {
    const root = document.getElementById("loop-svg");
    const CX = 600, CY = 200, RX = 230, RY = 140, GAP_DEG = 30;
    root.appendChild(arrowDefs("loop-arrow"));
    const STATIONS = [
      { deg: -90, t: "功能开工", l: ["声明当前模块", "起草验收条目 · 开始计时"] },
      { deg: 0, t: "会话开始", l: ["注入目标缺口", "推荐下一步"] },
      { deg: 90, t: "AI 编码", l: ["写测试（先失败）", "写实现（直到通过）"] },
      { deg: 180, t: "会话结束", l: ["跑验收测试 · 记 token", "重算并刷新五视图"] },
    ];
    const pt = (deg) => [CX + Math.cos((deg * Math.PI) / 180) * RX, CY + Math.sin((deg * Math.PI) / 180) * RY];
    STATIONS.forEach((s, i) => {
      const [x1, y1] = pt(s.deg + GAP_DEG), [x2, y2] = pt(STATIONS[(i + 1) % 4].deg - GAP_DEG + (i === 3 ? 360 : 0));
      root.appendChild(svg("path", { d: `M${x1},${y1} A${RX},${RY} 0 0 1 ${x2},${y2}`, fill: "none", stroke: "var(--ink)", "stroke-width": 2.5, "marker-end": "url(#loop-arrow)" }));
    });
    root.appendChild(text(CX, CY - 6, "每个功能", { "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: "var(--ink)" }));
    root.appendChild(text(CX, CY + 16, "循环一次", { "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: "var(--ink)" }));
    STATIONS.forEach((s) => root.appendChild(stationBox(...pt(s.deg), s.t, s.l)));
    const entry = [130, 200];
    root.appendChild(svg("path", { d: `M${entry[0] + 93},${entry[1] - 20} C330,90 420,60 ${CX - 99},${CY - RY}`, fill: "none", stroke: "var(--ok)", "stroke-width": 2.5, "stroke-dasharray": "7 5", "marker-end": "url(#loop-arrow)" }));
    root.appendChild(stationBox(...entry, "项目开始（一次）", ["确认目标 · 扫描生成三套架构", "初始化 .pm/"], true));
    root.appendChild(text(entry[0], entry[1] + 64, "Skill 在这里介入", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ok)" }));
  };

  // ---------- 两种形态 ----------
  const fileRow = (x, y, name, color, folder = false) => svg("g", { transform: `translate(${x},${y})` }, [
    folder ? svg("path", { d: "M0,-9 h7 l3,3 h10 v14 h-20 z", fill: "none", stroke: color, "stroke-width": 1.8 })
      : svg("path", { d: "M2,-10 h10 l5,5 v15 h-15 z", fill: "none", stroke: color, "stroke-width": 1.8 }),
    svg("text", { x: 28, y: 4, "font-size": 13, "font-family": "var(--font-mono)", fill: "var(--ink)" }, [name]),
  ]);
  const renderForms = () => {
    const root = document.getElementById("forms-svg");
    root.appendChild(arrowDefs("forms-arrow", "var(--doing)"));
    root.appendChild(text(40, 34, "形态 A · 本地", { "font-size": 16, "font-weight": 900, fill: "var(--ink)" }));
    root.appendChild(text(560, 34, "形态 B · 云端", { "font-size": 16, "font-weight": 900, fill: "var(--ink)" }));
    root.appendChild(svg("rect", { x: 30, y: 52, width: 290, height: 300, rx: 14, fill: "var(--paper-2)", stroke: "var(--ink)", "stroke-width": 2 }));
    [
      [50, 84, "my-project/", "var(--ink)", true],
      [74, 118, ".pm/", "var(--doing)", true],
      [100, 148, "pm.yaml", "var(--doing)"],
      [100, 176, "acceptance/*.feature", "var(--doing)"],
      [100, 204, "ledger.jsonl", "var(--doing)"],
      [100, 232, "dashboard.html", "var(--ok)"],
      [74, 300, "src/  （源代码）", "var(--ink-3)", true],
    ].forEach((row) => root.appendChild(fileRow(...row)));
    root.appendChild(svg("rect", { x: 66, y: 100, width: 238, height: 148, rx: 10, fill: "none", stroke: "var(--doing)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    root.appendChild(text(186, 268, "每个项目自带的「管理小项目」", { "text-anchor": "middle", "font-size": 11, fill: "var(--doing)", "font-weight": 700 }));

    // 本地 dashboard 缩略图
    const rand = seeded(3);
    root.appendChild(svg("g", { transform: "translate(350,150)" }, [
      svg("rect", { width: 150, height: 110, rx: 10, fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
      svg("rect", { width: 150, height: 18, rx: 10, fill: "var(--ink)" }),
      ...Array.from({ length: 24 }, (_, i) => {
        const st = STATE_ORDER[Math.floor(rand() * 4)];
        return svg("circle", { cx: 20 + (i % 8) * 16, cy: 38 + Math.floor(i / 8) * 22, r: 5.5, fill: STATE_META[st].color, opacity: STATE_META[st].dashed ? 0.5 : 1 });
      }),
    ]));
    root.appendChild(svg("path", { d: "M250,232 C300,232 310,205 344,205", fill: "none", stroke: "var(--ok)", "stroke-width": 2, "marker-end": "url(#forms-arrow)" }));
    root.appendChild(text(425, 280, "离线打开即看", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ok)" }));

    // 云端：账号 + 项目卡
    root.appendChild(svg("path", { d: "M610,120 a36,36 0 0,1 40,-50 a52,52 0 0,1 96,-10 a40,40 0 0,1 70,30 a30,30 0 0,1 -6,60 h-190 a30,30 0 0,1 -10,-30 z", fill: "var(--doing-tint)", stroke: "var(--doing)", "stroke-width": 2 }));
    root.appendChild(text(720, 118, "你的账号", { "text-anchor": "middle", "font-size": 15, "font-weight": 900, fill: "var(--doing)" }));
    PROJECTS.slice(0, 3).forEach((p, i) => {
      const x = 600 + i * 22, y = 180 + i * 34;
      root.appendChild(svg("g", { transform: `translate(${x},${y})` }, [
        svg("rect", { width: 250, height: 74, rx: 10, fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 1.8 }),
        svg("text", { x: 14, y: 22, "font-size": 12, "font-weight": 700, fill: "var(--ink)" }, [p.name]),
        svg("rect", { x: 14, y: 34, width: 160, height: 8, rx: 4, fill: "var(--paper-2)" }),
        svg("rect", { x: 14, y: 34, width: 1.6 * effPct(p), height: 8, rx: 4, fill: "var(--ok)" }),
        svg("text", { x: 184, y: 42, "font-size": 11, "font-family": "var(--font-mono)", fill: "var(--ink-2)" }, [`${effPct(p)}%`]),
      ]));
    });
    root.appendChild(text(760, 372, "新项目自动注册 · 多项目总览", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)" }));

    // 同步通道
    root.appendChild(svg("path", { d: "M304,120 C420,40 500,70 600,96", fill: "none", stroke: "var(--doing)", "stroke-width": 3, "marker-end": "url(#forms-arrow)" }));
    root.appendChild(text(450, 52, "只同步元数据", { "text-anchor": "middle", "font-weight": 900, fill: "var(--doing)", "font-size": 13 }));
    root.appendChild(text(450, 70, "pm.yaml · 状态 · 测试摘要 · 成本流水", { "text-anchor": "middle", "font-size": 11 }));
    root.appendChild(svg("line", { x1: 300, y1: 300, x2: 560, y2: 300, stroke: "var(--break)", "stroke-width": 2.5, "stroke-dasharray": "6 5" }));
    root.appendChild(svg("g", { transform: "translate(430,300)" }, [
      svg("circle", { r: 13, fill: "var(--break)" }),
      svg("path", { d: "M-5,-5 L5,5 M5,-5 L-5,5", stroke: "#fff", "stroke-width": 2.6, "stroke-linecap": "round" }),
    ]));
    root.appendChild(text(430, 330, "源代码不上传", { "text-anchor": "middle", "font-weight": 700, fill: "var(--break)" }));
  };

  // ---------- 多项目总览 ----------
  const dotGrid = (p) => {
    const states = STATE_ORDER.flatMap((st) => Array(p.counts[st]).fill(st));
    const COLS = 12, GAP = 15;
    const rows = Math.ceil(states.length / COLS);
    return svg("svg", { viewBox: `0 0 ${COLS * GAP} ${rows * GAP}`, style: "width:100%;height:auto;display:block", role: "img", "aria-label": `${states.length} 个模块` },
      states.map((st, i) => svg("circle", { cx: GAP / 2 + (i % COLS) * GAP, cy: GAP / 2 + Math.floor(i / COLS) * GAP, r: 5, fill: STATE_META[st].color, opacity: STATE_META[st].dashed ? 0.45 : 1 })));
  };
  const sparkline = (values) => {
    const W = 120, H = 28, max = Math.max(...values, 1);
    const d = values.map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`).join(" ");
    return svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "近 7 天 token 趋势" }, [svg("path", { d, fill: "none", stroke: "var(--ink)", "stroke-width": 2, "stroke-linejoin": "round" })]);
  };
  const renderToday = () => {
    document.getElementById("today").replaceChildren(
      html("h3", {}, ["今天最值得做的三件事（跨项目）"]),
      html("ol", {}, [
        html("li", {}, ["内部 BI 看板：接通数据仓库连接器 ", html("span", {}, ["—— 解锁 8 个已建未生效模块，G1 20% → 55%"])]),
        html("li", {}, [`智能知识库问答平台：${kbPlan.map((id) => byId.get(id).name).join(" → ")} `, html("span", {}, [`—— G1 ${kbBefore}% → ${kbAfter}%`])]),
        html("li", {}, ["跨境电商选品工具：复核 2 个被改动的验收测试 ", html("span", {}, ["—— 解除待复核，恢复可信状态"])]),
      ]),
    );
  };
  const renderPortfolio = () => {
    const root = document.getElementById("portfolio");
    [...PROJECTS].sort((a, b) => attention(b) - attention(a)).forEach((p, i) => {
      const alerts = [
        p.stuck ? chip(`卡住预警 ${p.stuck}`, "blocked") : null,
        p.review ? chip(`待复核 ${p.review}`, "doing") : null,
        p.staleDays >= 7 ? chip(`${p.staleDays} 天无进展`, "todo") : null,
      ].filter(Boolean);
      const weekTokens = p.tokens.reduce((a, b) => a + b, 0);
      root.appendChild(html("article", { class: "card proj" }, [
        html("div", { class: "proj-head" }, [html("h3", {}, [p.name]), html("span", { class: "rank" }, [`#${i + 1}`])]),
        html("div", { class: "chips" }, alerts.length ? alerts : [chip("一切正常", "ok")]),
        html("div", { class: "proj-body" }, [dotGrid(p), ring(effPct(p), "var(--ok)", 84, `${p.name} 生效度`)]),
        html("div", { style: "font-size:.8rem;color:var(--ink-2)" }, [`建成 ${builtPct(p)}% · 生效 ${effPct(p)}% · ${totalOf(p)} 个模块`]),
        html("div", { class: "chips" }, p.goals.map(([id, pct]) => chip(`${id} ${pct}%`, pct === 100 ? "ok" : pct >= 40 ? "blocked" : "todo"))),
        html("div", { style: "display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:var(--ink-3)" }, [
          html("span", {}, [`近 7 天 token ${weekTokens} 万`]), sparkline(p.tokens),
        ]),
      ]));
    });
  };

  // ---------- 路线 ----------
  const renderRoad = () => {
    const root = document.getElementById("road-svg");
    const PHASES = [["P0", "数据模型", "schema + 计算引擎", "local"], ["P1", "五视图", "dashboard.html", "local"], ["P2", "Skill", "三个钩子", "local"], ["P3", "本地面板", "Claude Code 常驻", "local"], ["P4", "云端", "账号 · 多项目总览", "cloud"]];
    const xs = PHASES.map((_, i) => 100 + i * 195), Y = 70;
    root.appendChild(svg("line", { x1: xs[0], x2: xs[3], y1: Y, y2: Y, stroke: "var(--ink)", "stroke-width": 4 }));
    root.appendChild(svg("line", { x1: xs[3], x2: xs[4], y1: Y, y2: Y, stroke: "var(--doing)", "stroke-width": 4, "stroke-dasharray": "8 6" }));
    root.appendChild(text((xs[0] + xs[3]) / 2, 28, "本地形态", { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 13 }));
    root.appendChild(text(xs[4], 28, "云端形态", { "text-anchor": "middle", "font-weight": 900, fill: "var(--doing)", "font-size": 13 }));
    PHASES.forEach(([id, t, s, kind], i) => {
      const color = kind === "cloud" ? "var(--doing)" : "var(--ink)";
      root.appendChild(svg("circle", { cx: xs[i], cy: Y, r: 20, fill: i === 0 ? color : "var(--card)", stroke: color, "stroke-width": 3 }));
      root.appendChild(text(xs[i], Y + 5, id, { "text-anchor": "middle", "font-family": "var(--font-mono)", "font-weight": 700, fill: i === 0 ? "var(--card)" : color }));
      root.appendChild(text(xs[i], Y + 48, t, { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
      root.appendChild(text(xs[i], Y + 68, s, { "text-anchor": "middle", "font-size": 12 }));
    });
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderHero, renderTrio, renderLoop, renderForms, renderToday, renderPortfolio, renderRoad];
})();
