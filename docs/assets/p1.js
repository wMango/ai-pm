// P1 文档页：单文件组成、生成流程、页面结构、安全链路、测试分布
(() => {
  "use strict";
  const { STATE_META, svg } = window.PM;
  const TEST_FILES = [
    ["load", 16, false], ["effective", 17, false], ["goals", 7, false], ["cost-blueprint", 14, false],
    ["dashboard-render", 6, true], ["cli", 9, true], ["dashboard-dom", 7, true],
  ];
  const PAGE_KB = 58;

  const text = (x, y, value, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [value]);
  const box = (x, y, w, h, title, sub, dark = false) => svg("g", { transform: `translate(${x - w / 2},${y - h / 2})` }, [
    svg("rect", { width: w, height: h, rx: 10, fill: dark ? "var(--ink)" : "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
    text(w / 2, sub ? h / 2 - 2 : h / 2 + 5, title, { "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: dark ? "var(--card)" : "var(--ink)" }),
    sub ? text(w / 2, h / 2 + 15, sub, { "text-anchor": "middle", "font-size": 10, "font-family": "var(--font-mono)", fill: dark ? "var(--card)" : "var(--ink-3)" }) : null,
  ].filter(Boolean));
  const defs = (id, color = "var(--ink)") => svg("defs", {}, [svg("marker", { id, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: color })])]);
  const arrow = (x1, y1, x2, y2, id, color = "var(--ink)") => svg("path", { d: `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`, fill: "none", stroke: color, "stroke-width": 2, "marker-end": `url(#${id})` });

  const renderFile = () => {
    const root = document.getElementById("file-svg");
    root.appendChild(svg("path", { d: "M70,30 h150 l40,40 v200 h-190 z", fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 2.5 }));
    root.appendChild(svg("path", { d: "M220,30 v40 h40", fill: "none", stroke: "var(--ink)", "stroke-width": 2.5 }));
    root.appendChild(text(165, 58, "dashboard.html", { "text-anchor": "middle", "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }));
    [["CSS 样式", "var(--doing)"], ["JS 五视图", "var(--ok)"], ["JSON 数据", "var(--blocked)"], ["CSP 安全策略", "var(--break)"]].forEach(([label, color], i) => {
      const y = 92 + i * 42;
      root.appendChild(svg("rect", { x: 90, y, width: 150, height: 32, rx: 7, fill: color, opacity: 0.16, stroke: color, "stroke-width": 1.8 }));
      root.appendChild(text(165, y + 21, label, { "text-anchor": "middle", "font-weight": 700, fill: "var(--ink)" }));
    });
    const stat = (y, big, small, color) => {
      root.appendChild(text(300, y, big, { "font-size": 34, "font-weight": 900, "font-family": "var(--font-mono)", fill: color }));
      root.appendChild(text(300, y + 22, small, { "font-size": 13 }));
    };
    stat(84, `${PAGE_KB} KB`, "整页一个文件", "var(--ink)");
    stat(164, "0", "次网络请求", "var(--ok)");
    stat(244, "5", "个可交互视图", "var(--doing)");
  };

  const renderFlow = () => {
    const root = document.getElementById("flow-svg");
    root.appendChild(defs("p1-arrow"));
    const inputs = [["pm.yaml", "必需"], ["evidence.json", "可选"], ["ledger.jsonl", "可选"]];
    inputs.forEach(([t, s], i) => {
      const y = 50 + i * 80;
      root.appendChild(arrow(170, y, 236, 130, "p1-arrow"));
      root.appendChild(box(95, y, 150, 50, t, s));
    });
    root.appendChild(box(310, 130, 140, 64, "pm dashboard", "src/cli.ts"));
    root.appendChild(arrow(380, 130, 430, 130, "p1-arrow"));
    root.appendChild(box(500, 130, 130, 64, "analyze()", "P0 引擎", true));
    root.appendChild(arrow(565, 130, 615, 130, "p1-arrow"));
    root.appendChild(box(690, 130, 140, 64, "renderDashboard", "转义 + CSP"));
    root.appendChild(arrow(760, 130, 810, 130, "p1-arrow"));
    root.appendChild(box(890, 130, 150, 64, "dashboard.html", "单文件 · 离线", true));
    root.appendChild(text(310, 196, "退出码 0 / 1 / 2", { "text-anchor": "middle", "font-size": 11 }));
    root.appendChild(text(310, 214, "警告打到 stderr，不阻止生成", { "text-anchor": "middle", "font-size": 11 }));
    root.appendChild(text(690, 196, "client/*.js 拼进一个闭包", { "text-anchor": "middle", "font-size": 11 }));
  };

  const GLYPH = {
    map: (x, y) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => svg("rect", { x: x + c * 26, y: y + r * 16, width: 20, height: 10, rx: 3, fill: STATE_META[["ok", "blocked", "todo"][(r + c) % 3]].color }))),
    bars: (x, y) => [70, 46, 22].map((w, i) => svg("rect", { x, y: y + i * 16, width: w, height: 10, rx: 3, fill: i ? "var(--blocked)" : "var(--break)" })),
    rings: (x, y) => [0, 1].map((i) => svg("circle", { cx: x + 14 + i * 40, cy: y + 18, r: 14, fill: "none", stroke: i ? "var(--ok)" : "var(--blocked)", "stroke-width": 5 })),
    bubbles: (x, y) => [[10, 34, 6], [36, 20, 10], [62, 10, 13]].map(([dx, dy, r]) => svg("circle", { cx: x + dx, cy: y + dy, r, fill: "var(--doing-tint)", stroke: "var(--doing)", "stroke-width": 2 })),
    lanes: (x, y) => [0, 1, 2].map((i) => svg("line", { x1: x, x2: x + 74, y1: y + 6 + i * 14, y2: y + 6 + i * 14, stroke: i === 1 ? "var(--ink)" : "var(--ink-3)", "stroke-width": 2, "stroke-dasharray": "5 3" })).concat([svg("line", { x1: x + 40, x2: x + 40, y1: y, y2: y + 40, stroke: "var(--break)", "stroke-width": 3 })]),
  };
  const renderAnatomy = () => {
    const root = document.getElementById("anatomy-svg");
    const SECTIONS = [
      ["① 架构地图", "功能 / 逻辑 / 物理切换，建成 / 生效视角，点击看根因", "map"],
      ["② 依赖与阻塞", "哪条根因链卡住了最多已写好的模块", "bars"],
      ["③ 目标与下一步", "目标进度环、杠杆排序的推荐、What-if", "rings"],
      ["④ 成本", "时间 × token 气泡图、卡住预警、沉没成本", "bubbles"],
      ["⑤ 旅程蓝图", "泳道、可见线、可用性曲线、切线、断点", "lanes"],
    ];
    SECTIONS.forEach(([title, desc, glyph], i) => {
      const y = 12 + i * 62;
      root.appendChild(svg("rect", { x: 10, y, width: 980, height: 52, rx: 12, fill: i % 2 ? "var(--card)" : "var(--paper-2)", stroke: "var(--line)" }));
      GLYPH[glyph](36, y + 6).forEach((n) => root.appendChild(n));
      root.appendChild(text(140, y + 23, title, { "font-size": 15, "font-weight": 900, fill: "var(--ink)" }));
      root.appendChild(text(140, y + 42, desc));
      root.appendChild(text(970, y + 32, "点击 → 跳到地图", { "text-anchor": "end", "font-size": 11, fill: "var(--doing)" }));
    });
  };

  const renderSecurity = () => {
    const root = document.getElementById("sec-svg");
    root.appendChild(defs("sec-arrow", "var(--ok)"));
    const evil = '<img onerror=…>';
    root.appendChild(svg("g", { transform: "translate(20,70)" }, [
      svg("rect", { width: 150, height: 70, rx: 12, fill: "var(--blocked-tint)", stroke: "var(--break)", "stroke-width": 2, "stroke-dasharray": "6 4" }),
      text(75, 30, "pm.yaml 里的名字", { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)" }),
      text(75, 52, evil, { "text-anchor": "middle", "font-family": "var(--font-mono)", fill: "var(--break)" }),
    ]));
    const GATES = [
      ["① 序列化", "< → \\u003c", "跳不出 <script>"],
      ["② CSP", "只放行本页脚本哈希", "注入脚本被拦截"],
      ["③ textContent", "不用 innerHTML", "只会是文字"],
    ];
    GATES.forEach(([t, s, r], i) => {
      const x = 230 + i * 220;
      root.appendChild(arrow(x - 40, 105, x - 4, 105, "sec-arrow", "var(--ok)"));
      root.appendChild(svg("g", { transform: `translate(${x},50)` }, [
        svg("rect", { width: 170, height: 110, rx: 14, fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 2 }),
        svg("rect", { width: 170, height: 34, rx: 14, fill: "var(--ink)" }),
        text(85, 23, t, { "text-anchor": "middle", "font-weight": 900, fill: "var(--card)", "font-size": 14 }),
        text(85, 62, s, { "text-anchor": "middle", "font-family": "var(--font-mono)", fill: "var(--ink)" }),
        text(85, 88, r, { "text-anchor": "middle", "font-weight": 700, fill: "var(--ok)" }),
      ]));
    });
    root.appendChild(text(500, 200, "终端输出同样去掉控制字符，防止 pm.yaml 片段里的转义序列操纵终端", { "text-anchor": "middle", "font-size": 12 }));
  };

  const renderTests = () => {
    const root = document.getElementById("tests-svg");
    const total = TEST_FILES.reduce((a, [, n]) => a + n, 0);
    const added = TEST_FILES.filter(([, , isNew]) => isNew).reduce((a, [, n]) => a + n, 0) + 1;
    root.appendChild(text(0, 18, `${total} 个测试 · P1 新增 ${added} 个`, { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    const max = Math.max(...TEST_FILES.map(([, n]) => n));
    TEST_FILES.forEach(([name, n, isNew], i) => {
      const y = 40 + i * 30;
      root.appendChild(text(130, y + 14, name, { "text-anchor": "end", "font-family": "var(--font-mono)", fill: "var(--ink)" }));
      root.appendChild(svg("rect", { x: 140, y, width: (260 * n) / max, height: 18, rx: 5, fill: isNew ? "var(--ok)" : "var(--ink-3)" }));
      root.appendChild(text(146 + (260 * n) / max, y + 14, String(n), { "font-family": "var(--font-mono)", "font-weight": 700, fill: "var(--ink)" }));
    });
    root.appendChild(svg("rect", { x: 140, y: 250 - 6, width: 12, height: 10, rx: 2, fill: "var(--ok)" }));
    root.appendChild(text(158, 252, "P1 新增（含 1 个 analyze 扩展测试）", { "font-size": 11 }));
  };

  const renderExit = () => {
    const root = document.getElementById("exit-svg");
    root.appendChild(text(0, 18, "CLI 退出码", { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
    [
      ["0", "成功", "生成页面；有警告也算成功", "var(--ok)"],
      ["1", "输入有误", "缺 pm.yaml、校验失败、验收结果不合法", "var(--break)"],
      ["2", "用法错误", "未知命令、参数缺值、--now 不合法", "var(--blocked)"],
    ].forEach(([code, title, desc, color], i) => {
      const y = 44 + i * 70;
      root.appendChild(svg("circle", { cx: 28, cy: y + 22, r: 22, fill: color }));
      root.appendChild(text(28, y + 30, code, { "text-anchor": "middle", "font-family": "var(--font-mono)", "font-weight": 900, fill: "#fff", "font-size": 20 }));
      root.appendChild(text(64, y + 16, title, { "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
      root.appendChild(text(64, y + 36, desc));
    });
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderFile, renderFlow, renderAnatomy, renderSecurity, renderTests, renderExit];
})();
