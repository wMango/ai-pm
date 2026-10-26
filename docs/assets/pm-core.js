// 示例数据 + 计算引擎（纯函数）+ DOM 工具，供各页面共用
(() => {
  "use strict";

  // ---------- 数据 ----------
  const LAYERS = [
    { id: "front", name: "前端层", y: 75 },
    { id: "service", name: "服务层", y: 195 },
    { id: "data", name: "数据层", y: 315 },
    { id: "external", name: "外部", y: 435 },
  ];
  const COL = [170, 360, 550, 740, 930];
  // days：自验收条目锁定起已投入的天数；ktokens：AI 在该模块上累计消耗的 token（千）
  const MODULES = [
    { id: "dash", name: "数据看板", layer: "front", col: 0, status: "todo", deps: ["bill"], days: 0, ktokens: 0 },
    { id: "login", name: "登录页", layer: "front", col: 1, status: "done", deps: ["auth"], days: 2.5, ktokens: 180 },
    { id: "chatui", name: "对话界面", layer: "front", col: 2, status: "done", deps: ["chatsvc"], days: 4, ktokens: 420 },
    { id: "kb", name: "知识库管理台", layer: "front", col: 4, status: "doing", deps: ["parse"], days: 6, ktokens: 610 },
    { id: "bill", name: "计费服务", layer: "service", col: 0, status: "todo", deps: ["userdb"], days: 0, ktokens: 0 },
    { id: "auth", name: "用户认证", layer: "service", col: 1, status: "done", deps: ["userdb"], days: 1, ktokens: 150 },
    { id: "chatsvc", name: "对话服务", layer: "service", col: 2, status: "done", deps: ["retr", "llm"], days: 5, ktokens: 520 },
    { id: "retr", name: "向量检索", layer: "service", col: 3, status: "todo", deps: ["vdb"], days: 0, ktokens: 0 },
    { id: "parse", name: "文档解析", layer: "service", col: 4, status: "done", deps: ["oss", "retr"], days: 3, ktokens: 380 },
    { id: "userdb", name: "用户库", layer: "data", col: 1, status: "done", deps: [], days: 0.5, ktokens: 60 },
    { id: "vdb", name: "向量数据库", layer: "data", col: 3, status: "todo", deps: [], days: 0, ktokens: 0 },
    { id: "oss", name: "对象存储", layer: "data", col: 4, status: "done", deps: [], days: 3, ktokens: 40 },
    { id: "llm", name: "LLM 网关", layer: "external", col: 2, status: "done", deps: [], days: 2, ktokens: 90 },
  ];
  const GOALS = [
    { id: "G1", name: "用户能基于自有文档提问并得到答案", requires: ["login", "chatui", "kb"] },
    { id: "G2", name: "用户能安全登录与管理账号", requires: ["login"] },
    { id: "G3", name: "平台可按用量计费", requires: ["dash"] },
  ];
  const NODE_W = 150, NODE_H = 46;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STATE_META = {
    todo: { label: "未建", color: "var(--todo)", tint: "var(--todo-tint)", dashed: true, desc: "没有验收测试，或尚无实现" },
    doing: { label: "进行中", color: "var(--doing)", tint: "var(--doing-tint)", dashed: true, desc: "有验收测试，但未全部通过" },
    blocked: { label: "已建未生效", color: "var(--blocked)", tint: "var(--blocked-tint)", dashed: false, desc: "自身验收通过，但上游未生效，价值被卡住" },
    ok: { label: "已生效", color: "var(--ok)", tint: "var(--ok-tint)", dashed: false, desc: "自身验收通过，且所有硬依赖都已生效" },
  };

  // ---------- 计算引擎（纯函数） ----------
  const byId = new Map(MODULES.map((m) => [m.id, m]));
  const dependents = (id) => MODULES.filter((m) => m.deps.includes(id)).map((m) => m.id);

  const closure = (id, next) => {
    const seen = new Set();
    const walk = (x) => { if (seen.has(x)) return; seen.add(x); next(x).forEach(walk); };
    walk(id);
    return seen;
  };
  const upstream = (id) => closure(id, (x) => byId.get(x).deps);
  const downstream = (id) => closure(id, dependents);

  const computeEffective = (statusOf) => {
    const memo = new Map();
    const eff = (id) => {
      if (memo.has(id)) return memo.get(id);
      const m = byId.get(id);
      const result = statusOf(id) === "done" && m.deps.every(eff);
      memo.set(id, result);
      return result;
    };
    return new Map(MODULES.map((m) => [m.id, eff(m.id)]));
  };
  const baseStatus = (id) => byId.get(id).status;
  const EFFECTIVE = computeEffective(baseStatus);

  const displayState = (id, mode) => {
    const s = byId.get(id).status;
    if (s !== "done") return s;
    if (mode === "built") return "ok";
    return EFFECTIVE.get(id) ? "ok" : "blocked";
  };

  const rootBlockers = (id) => [...upstream(id)].filter((x) => x !== id && byId.get(x).status !== "done");

  const goalClosure = (goal) => {
    const all = new Set();
    goal.requires.forEach((r) => upstream(r).forEach((x) => all.add(x)));
    return [...all];
  };
  const goalProgress = (goal, effMap) => {
    const nodes = goalClosure(goal);
    const okCount = nodes.filter((x) => effMap.get(x)).length;
    return { nodes, okCount, pct: Math.round((okCount / nodes.length) * 100) };
  };
  const goalsOf = (id) => GOALS.filter((g) => goalClosure(g).includes(id));

  const leverage = () => MODULES
    .filter((m) => m.status !== "done")
    .map((m) => ({ m, unblock: downstream(m.id).size - 1, goals: goalsOf(m.id) }))
    .sort((a, b) => b.unblock - a.unblock || b.goals.length - a.goals.length);

  const whatIf = (doneIds) => computeEffective((id) => (doneIds.includes(id) ? "done" : baseStatus(id)));

  // ---------- DOM 工具 ----------
  const svg = (tag, attrs = {}, children = []) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  };
  const html = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => (k === "class" ? (node.className = v) : node.setAttribute(k, v)));
    children.forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  };
  const chip = (text, kind) => html("span", { class: `chip ${kind}` }, [text]);
  const posOf = (m) => ({ x: COL[m.col], y: LAYERS.find((l) => l.id === m.layer).y });

  const nodeGlyph = (state, w = 44, h = 30) => {
    const meta = STATE_META[state];
    return svg("svg", { viewBox: `0 0 ${w + 4} ${h + 4}`, width: w + 4, height: h + 4 }, [
      svg("rect", { x: 2, y: 2, width: w, height: h, rx: 7, fill: meta.tint, stroke: meta.color, "stroke-width": 2.2, "stroke-dasharray": meta.dashed ? "5 4" : "none" }),
      svg("rect", { x: 2, y: 2, width: 7, height: h, rx: 3, fill: meta.color, opacity: meta.dashed ? 0.4 : 1 }),
    ]);
  };

  const ring = (pct, color, size = 96, label) => {
    const r = size / 2 - 9, c = 2 * Math.PI * r;
    return svg("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: "img", "aria-label": label }, [
      svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--paper-2)", "stroke-width": 10 }),
      svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: color, "stroke-width": 10, "stroke-linecap": "round",
        "stroke-dasharray": `${(c * pct) / 100} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }),
      svg("text", { x: size / 2, y: size / 2 + 7, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-weight": 700, "font-size": size / 4.6, fill: "var(--ink)" }, [`${pct}%`]),
    ]);
  };

  window.PM = Object.freeze({
    LAYERS, COL, MODULES, GOALS, NODE_W, NODE_H, STATE_META,
    byId, dependents, upstream, downstream, computeEffective, baseStatus, EFFECTIVE,
    displayState, rootBlockers, goalClosure, goalProgress, goalsOf, leverage, whatIf,
    svg, html, chip, posOf, nodeGlyph, ring,
  });
})();
