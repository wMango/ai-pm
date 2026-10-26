// P2 文档页：生命周期、泳道时间线、会话结束预算、token 口径、锁定状态机、.pm 目录、测试分布
(() => {
  "use strict";
  const { STATE_META, svg } = window.PM;
  // 本项目这次真实会话的 token 构成（按 message.id 去重后）
  const SESSION_TOKENS = { output: 285328, cacheWrite: 679000, input: 268, cacheRead: 40098009 };
  const TEST_FILES = [["workflow", 14], ["verify", 11], ["tokens-hooks", 13], ["hardening", 15]];
  const TOTAL_TESTS = 129;
  // 审查发现：[级别, 总数, 已修复]
  const FINDINGS = [["HIGH", 2, 2, "var(--break)"], ["MEDIUM", 8, 8, "var(--blocked)"], ["LOW", 6, 5, "var(--doing)"]];

  const text = (x, y, value, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [value]);
  const marker = (id, color = "var(--ink)") => svg("defs", {}, [svg("marker", { id, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: color })])]);
  const pill = (x, y, w, label, fill, color = "var(--card)") => svg("g", { transform: `translate(${x - w / 2},${y - 15})` }, [
    svg("rect", { width: w, height: 30, rx: 15, fill }),
    text(w / 2, 20, label, { "text-anchor": "middle", "font-weight": 700, fill: color }),
  ]);
  const wan = (n) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 1e6 ? 0 : 1)} 万` : String(n));

  const renderHero = () => {
    const root = document.getElementById("hero-svg");
    root.appendChild(marker("hero-arrow"));
    const CX = 260, CY = 165, R = 112;
    const stages = [
      { deg: -90, t: "① 项目开始", s: "init · 确认目标 · 三套架构", dark: true },
      { deg: 30, t: "② 开始做功能", s: "start · 条目 · 锁定 · 先失败" },
      { deg: 150, t: "③ 会话结束", s: "记 token · 验收 · 刷新" },
    ];
    const pt = (deg, r = R) => [CX + Math.cos((deg * Math.PI) / 180) * r, CY + Math.sin((deg * Math.PI) / 180) * r];
    stages.forEach((st, i) => {
      const [x1, y1] = pt(st.deg + 34), [x2, y2] = pt(stages[(i + 1) % 3].deg - 34 + (i === 2 ? 360 : 0));
      root.appendChild(svg("path", { d: `M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`, fill: "none", stroke: "var(--ink)", "stroke-width": 2.5, "marker-end": "url(#hero-arrow)" }));
    });
    stages.forEach((st) => {
      const [x, y] = pt(st.deg);
      root.appendChild(svg("g", { transform: `translate(${x - 86},${y - 28})` }, [
        svg("rect", { width: 172, height: 56, rx: 12, fill: st.dark ? "var(--ink)" : "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
        text(86, 24, st.t, { "text-anchor": "middle", "font-weight": 900, "font-size": 14, fill: st.dark ? "var(--card)" : "var(--ink)" }),
        text(86, 42, st.s, { "text-anchor": "middle", "font-size": 10.5, fill: st.dark ? "var(--card)" : "var(--ink-2)" }),
      ]));
    });
    root.appendChild(text(CX, CY - 4, "每个功能", { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 15 }));
    root.appendChild(text(CX, CY + 16, "循环一次", { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 15 }));
  };

  const LANES = [["人", 60], ["AI", 165], ["钩子", 265]];
  const renderLanes = () => {
    const root = document.getElementById("lanes-svg");
    root.appendChild(marker("lane-arrow"));
    LANES.forEach(([name, y], i) => {
      root.appendChild(svg("rect", { x: 0, y: y - 42, width: 1000, height: 84, rx: 10, fill: i % 2 ? "transparent" : "var(--paper-2)", opacity: 0.6 }));
      root.appendChild(text(18, y + 5, name, { "font-weight": 900, "font-size": 15, fill: "var(--ink-3)" }));
    });
    const Y = Object.fromEntries(LANES);
    const EVENTS = [
      ["钩子", 120, "SessionStart", "注入摘要与下一步", "var(--doing)"],
      ["AI", 215, "pm start", "声明模块", "var(--ink)"],
      ["AI", 320, "起草条目", ".feature", "var(--ink)"],
      ["人", 420, "逐条确认", "功能层必需", "var(--ok)"],
      ["AI", 515, "测试先失败", "pm verify", "var(--break)"],
      ["人", 610, "终端按 y", "pm lock", "var(--ok)"],
      ["钩子", 700, "Stop", "记 token · 刷新", "var(--doing)"],
      ["AI", 790, "实现到通过", "pm verify", "var(--ok)"],
      ["钩子", 900, "SessionEnd", "后台验收", "var(--doing)"],
    ];
    EVENTS.slice(0, -1).forEach(([lane, x], i) => {
      const [nLane, nx] = EVENTS[i + 1];
      root.appendChild(svg("path", { d: `M${x + 44},${Y[lane]} C${x + 70},${Y[lane]} ${nx - 70},${Y[nLane]} ${nx - 48},${Y[nLane]}`, fill: "none", stroke: "var(--ink-3)", "stroke-width": 1.6, "marker-end": "url(#lane-arrow)" }));
    });
    EVENTS.forEach(([lane, x, title, sub, color]) => {
      root.appendChild(svg("g", { transform: `translate(${x - 44},${Y[lane] - 26})` }, [
        svg("rect", { width: 88, height: 52, rx: 10, fill: "var(--card)", stroke: color, "stroke-width": 2.2 }),
        text(44, 22, title, { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 12 }),
        text(44, 40, sub, { "text-anchor": "middle", "font-size": 10 }),
      ]));
    });
    root.appendChild(text(700, 318, "每轮对话都会触发 Stop", { "text-anchor": "middle", "font-size": 11, fill: "var(--doing)" }));
  };

  const renderEnd = () => {
    const root = document.getElementById("end-svg");
    const X0 = 140, PX_PER_SEC = 160;
    const sx = (s) => X0 + s * PX_PER_SEC;
    [0, 1, 2, 3, 4, 5].forEach((s) => {
      root.appendChild(svg("line", { x1: sx(s), x2: sx(s), y1: 20, y2: 175, stroke: "var(--line)", "stroke-dasharray": "2 4" }));
      root.appendChild(text(sx(s), 195, `${s} 秒`, { "text-anchor": "middle", "font-family": "var(--font-mono)", fill: "var(--ink-3)" }));
    });
    root.appendChild(svg("rect", { x: sx(0), y: 30, width: sx(1.5) - sx(0), height: 140, fill: "var(--ok)", opacity: 0.08 }));
    root.appendChild(svg("line", { x1: sx(1.5), x2: sx(1.5), y1: 20, y2: 175, stroke: "var(--break)", "stroke-width": 2, "stroke-dasharray": "6 4" }));
    root.appendChild(text(sx(1.5) + 6, 30, "SessionEnd 预算 1.5 秒", { fill: "var(--break)", "font-weight": 700 }));
    const row = (y, label, from, to, color, note, dashed = false) => {
      root.appendChild(text(X0 - 12, y + 15, label, { "text-anchor": "end", "font-weight": 700, fill: "var(--ink)" }));
      root.appendChild(svg("rect", { x: sx(from), y, width: Math.max(4, sx(to) - sx(from)), height: 22, rx: 6, fill: color, opacity: dashed ? 0.35 : 1, stroke: color, "stroke-dasharray": dashed ? "5 4" : null }));
      root.appendChild(text(sx(to) + 8, y + 15, note, { "font-size": 11 }));
    };
    row(52, "同步跑测试", 0, 3.6, "var(--break)", "超时被终止，验收没跑完", true);
    row(96, "钩子（实测）", 0, 0.08, "var(--ok)", "0.08 秒返回");
    row(132, "后台进程", 0.08, 2.4, "var(--doing)", "记 token → 验收 → 刷新 → last-run.log");
  };

  const renderTokens = () => {
    const root = document.getElementById("tokens-svg");
    const total = Object.values(SESSION_TOKENS).reduce((a, b) => a + b, 0);
    const processed = SESSION_TOKENS.input + SESSION_TOKENS.output + SESSION_TOKENS.cacheWrite;
    root.appendChild(text(0, 18, "本次会话的 token 构成", { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    const W = 440;
    let x = 0;
    [["缓存读取", SESSION_TOKENS.cacheRead, "var(--todo)"], ["缓存写入", SESSION_TOKENS.cacheWrite, "var(--blocked)"], ["输出", SESSION_TOKENS.output, "var(--ok)"]].forEach(([, v, c]) => {
      const w = (v / total) * W;
      root.appendChild(svg("rect", { x, y: 36, width: Math.max(w, 2), height: 34, fill: c }));
      x += w;
    });
    const rows = [
      ["缓存读取", SESSION_TOKENS.cacheRead, "var(--todo)", "默认不计入"],
      ["缓存写入", SESSION_TOKENS.cacheWrite, "var(--blocked)", "计入"],
      ["输出", SESSION_TOKENS.output, "var(--ok)", "计入"],
      ["输入", SESSION_TOKENS.input, "var(--doing)", "计入"],
    ];
    rows.forEach(([label, v, c, note], i) => {
      const y = 104 + i * 30;
      root.appendChild(svg("rect", { x: 0, y: y - 11, width: 14, height: 14, rx: 3, fill: c }));
      root.appendChild(text(22, y, label, { fill: "var(--ink)", "font-weight": 700 }));
      root.appendChild(text(150, y, wan(v), { "font-family": "var(--font-mono)", fill: "var(--ink)" }));
      root.appendChild(text(250, y, `${((v / total) * 100).toFixed(1)}%`, { "font-family": "var(--font-mono)" }));
      root.appendChild(text(330, y, note, { fill: note === "计入" ? "var(--ok)" : "var(--ink-3)", "font-weight": 700 }));
    });
    root.appendChild(text(0, 248, `默认口径（processed）：${wan(processed)}`, { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    root.appendChild(text(0, 268, "改成 tokenCount: all 即可把缓存读取也计入", { "font-size": 11 }));
  };

  const renderDelta = () => {
    const root = document.getElementById("delta-svg");
    root.appendChild(marker("delta-arrow"));
    root.appendChild(text(0, 18, "按消息去重 + 增量记录", { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    [0, 1, 2].forEach((i) => root.appendChild(svg("rect", { x: 0, y: 36 + i * 22, width: 150, height: 16, rx: 4, fill: "var(--paper-2)", stroke: "var(--ink-3)" })));
    root.appendChild(text(75, 48, "message m1 · usage", { "text-anchor": "middle", "font-size": 10, "font-family": "var(--font-mono)" }));
    root.appendChild(text(75, 70, "message m1 · usage", { "text-anchor": "middle", "font-size": 10, "font-family": "var(--font-mono)" }));
    root.appendChild(text(75, 92, "message m1 · usage", { "text-anchor": "middle", "font-size": 10, "font-family": "var(--font-mono)" }));
    root.appendChild(svg("path", { d: "M156,70 L196,70", stroke: "var(--ink)", "stroke-width": 2, "marker-end": "url(#delta-arrow)" }));
    root.appendChild(pill(260, 70, 110, "只算 1 次", "var(--ok)"));
    root.appendChild(text(0, 126, "同一条回复被拆成多行（本机实测最多 6 行），每行重复同一份用量", { "font-size": 11 }));
    const steps = [["第 1 轮", 0, 300, "a"], ["第 2 轮", 300, 520, "a"], ["切到 b", 520, 700, "b"]];
    steps.forEach(([label, from, to, node], i) => {
      const y = 160 + i * 34;
      const sx = (v) => 70 + v * 0.5;
      root.appendChild(text(60, y + 14, label, { "text-anchor": "end", fill: "var(--ink)", "font-weight": 700 }));
      root.appendChild(svg("rect", { x: sx(0), y, width: sx(from) - sx(0), height: 20, rx: 4, fill: "var(--paper-2)" }));
      root.appendChild(svg("rect", { x: sx(from), y, width: sx(to) - sx(from), height: 20, rx: 4, fill: node === "a" ? "var(--ok)" : "var(--doing)" }));
      root.appendChild(text(sx(to) + 8, y + 14, `+${to - from} → ${node}`, { "font-family": "var(--font-mono)", fill: "var(--ink)" }));
    });
    root.appendChild(text(0, 272, "累计 − 已记录 = 本次新增，记到当前模块", { "font-size": 11 }));
  };

  const renderLock = () => {
    const root = document.getElementById("lock-svg");
    root.appendChild(marker("lock-arrow"));
    const node = (x, y, label, state, sub) => {
      const meta = STATE_META[state];
      root.appendChild(svg("g", { transform: `translate(${x - 80},${y - 30})` }, [
        svg("rect", { width: 160, height: 60, rx: 12, fill: meta.tint, stroke: meta.color, "stroke-width": 2.4, "stroke-dasharray": meta.dashed ? "6 4" : null }),
        text(80, 26, label, { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 14 }),
        text(80, 45, sub, { "text-anchor": "middle", "font-size": 10.5 }),
      ]));
    };
    const link = (x1, y1, x2, y2, label, color = "var(--ink)", bend = 0) => {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + bend;
      root.appendChild(svg("path", { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, fill: "none", stroke: color, "stroke-width": 2, "marker-end": "url(#lock-arrow)" }));
      root.appendChild(text(mx, my - 6 + (bend > 0 ? 20 : 0), label, { "text-anchor": "middle", "font-size": 11, fill: color, "font-weight": 700 }));
    };
    node(120, 125, "未锁定", "doing", "条目或测试刚写好");
    node(500, 125, "已锁定", "ok", "locks.json 记录指纹");
    node(880, 125, "待复核", "blocked", "页面与上下文醒目提示");
    link(200, 125, 418, 125, "人确认 / AI 自签 → pm lock");
    link(580, 112, 798, 112, "改了条目或测试", "var(--break)", -40);
    link(580, 138, 798, 138, "增删验收文件", "var(--break)", 40);
    link(880, 158, 500, 158, "人复核后重新 pm lock", "var(--ok)", 70);
    root.appendChild(text(120, 190, "从未锁定也算待复核", { "text-anchor": "middle", "font-size": 11, fill: "var(--blocked)", "font-weight": 700 }));
  };

  const renderTree = () => {
    const root = document.getElementById("tree-svg");
    const FILES = [
      [".pm/", "", true, ""],
      ["pm.yaml", "人 + AI", true, "git"],
      ["acceptance/*.feature", "条目", true, "git"],
      ["locks.json", "谁确认过什么", true, "git"],
      ["evidence.json", "验收结果", true, "git"],
      ["ledger.jsonl", "token 流水", true, "git"],
      ["dashboard.html", "项目地图", true, "自定"],
      ["current.json", "当前模块", false, "本机"],
      ["last-run.log", "后台日志", false, "本机"],
      ["trusted-runners", "本机信任记录", false, "本机"],
    ];
    FILES.forEach(([name, note, tracked, tag], i) => {
      const y = 20 + i * 28;
      const indent = i === 0 ? 0 : 26;
      if (i) root.appendChild(svg("path", { d: `M10,${y - 22} V${y - 4} H${indent - 4}`, fill: "none", stroke: "var(--ink-3)" }));
      root.appendChild(svg("path", { d: i === 0 ? `M${indent},${y - 9} h8 l3,3 h11 v14 h-22 z` : `M${indent},${y - 10} h11 l5,5 v15 h-16 z`, fill: "none", stroke: tracked ? "var(--ink)" : "var(--ink-3)", "stroke-width": 1.8 }));
      root.appendChild(text(indent + 30, y + 4, name, { "font-family": "var(--font-mono)", fill: tracked ? "var(--ink)" : "var(--ink-3)", "font-weight": 700 }));
      if (note) root.appendChild(text(260, y + 4, note, { "font-size": 11 }));
      if (tag) root.appendChild(pill(420, y, 52, tag, tag === "git" ? "var(--ok)" : tag === "本机" ? "var(--todo)" : "var(--blocked)"));
    });
  };

  const renderTests = () => {
    const root = document.getElementById("tests-svg");
    const added = TEST_FILES.reduce((a, [, n]) => a + n, 0);
    root.appendChild(text(0, 18, `${TOTAL_TESTS} 个测试 · P2 新增 ${added} 个`, { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    const max = Math.max(...TEST_FILES.map(([, n]) => n));
    TEST_FILES.forEach(([name, n], i) => {
      const y = 50 + i * 40;
      root.appendChild(text(110, y + 15, name, { "text-anchor": "end", "font-family": "var(--font-mono)", fill: "var(--ink)" }));
      root.appendChild(svg("rect", { x: 120, y, width: (240 * n) / max, height: 22, rx: 6, fill: "var(--ok)" }));
      root.appendChild(text(126 + (240 * n) / max, y + 16, String(n), { "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }));
    });
    root.appendChild(text(0, 220, "另外用打包后的 pm.mjs 做了两轮端到端演练：", { fill: "var(--ink)", "font-weight": 700 }));
    ["初始化 → 开工 → 锁定 → 测试先失败", "Stop 记 token → SessionEnd 0.08 秒返回", "改测试变待复核 · 未信任不跑 · 注入被挡住"].forEach((t, i) =>
      root.appendChild(text(14, 244 + i * 20, `✓ ${t}`, { fill: "var(--ok)", "font-weight": 700 })));
  };

  const renderReview = () => {
    const root = document.getElementById("review-svg");
    root.appendChild(text(0, 18, "审查发现 16 条 · 已修复 15 条", { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    const CELL = 26, GAP = 6;
    FINDINGS.forEach(([level, total, fixed, color], i) => {
      const y = 44 + i * 58;
      root.appendChild(text(0, y + 18, level, { "font-family": "var(--font-mono)", "font-weight": 900, fill: color }));
      for (let k = 0; k < total; k++) {
        const done = k < fixed;
        root.appendChild(svg("rect", { x: 90 + k * (CELL + GAP), y, width: CELL, height: CELL, rx: 6, fill: done ? color : "none", stroke: color, "stroke-width": 2, "stroke-dasharray": done ? null : "4 3" }));
        if (done) root.appendChild(svg("path", { d: `M${96 + k * (CELL + GAP)},${y + 13} l5,5 l9,-10`, stroke: "#fff", "stroke-width": 2.4, fill: "none", "stroke-linecap": "round" }));
      }
      root.appendChild(text(90, y + 44, `${fixed}/${total} 已修复`, { "font-size": 11 }));
    });
    root.appendChild(text(0, 236, "人确认已改为终端按 y；未修：超时后残留孙进程", { "font-size": 11, fill: "var(--ink-3)" }));
  };

  const renderTrust = () => {
    const root = document.getElementById("trust-svg");
    root.appendChild(marker("trust-arrow"));
    const box = (x, y, w, title, sub, color) => root.appendChild(svg("g", { transform: `translate(${x - w / 2},${y - 24})` }, [
      svg("rect", { width: w, height: 48, rx: 10, fill: "var(--card)", stroke: color, "stroke-width": 2.2 }),
      text(w / 2, 20, title, { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 13 }),
      text(w / 2, 37, sub, { "text-anchor": "middle", "font-size": 10.5 }),
    ]));
    box(80, 40, 140, "会话结束", "后台进程启动", "var(--ink)");
    root.appendChild(svg("path", { d: "M80,40 m0,24 L80,104", stroke: "var(--ink)", "stroke-width": 2, "marker-end": "url(#trust-arrow)" }));
    root.appendChild(svg("path", { d: "M80,104 l70,30 l-70,30 l-70,-30 z", fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }));
    root.appendChild(text(80, 138, "runners 指纹", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)" }));
    root.appendChild(text(80, 152, "= 本机信任？", { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)" }));
    root.appendChild(svg("path", { d: "M150,134 L232,80", stroke: "var(--ok)", "stroke-width": 2, "marker-end": "url(#trust-arrow)" }));
    root.appendChild(text(178, 98, "是", { fill: "var(--ok)", "font-weight": 900 }));
    box(330, 80, 190, "自动跑验收", "写 evidence · 刷新页面", "var(--ok)");
    root.appendChild(svg("path", { d: "M150,134 L232,190", stroke: "var(--break)", "stroke-width": 2, "marker-end": "url(#trust-arrow)" }));
    root.appendChild(text(178, 182, "否", { fill: "var(--break)", "font-weight": 900 }));
    box(330, 190, 190, "跳过验收", "日志提示：运行 pm trust", "var(--break)");
    root.appendChild(text(0, 252, "指纹 = runners + 超时；信任记录只在本机，不进 git", { "font-size": 11 }));
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderHero, renderLanes, renderEnd, renderTokens, renderDelta, renderLock, renderReview, renderTrust, renderTree, renderTests];
})();
