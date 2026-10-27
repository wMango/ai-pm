// 多平台说明页：中心辐射图、能力矩阵、安装卡片、OpenCode 事件映射、自动化分工
(() => {
  "use strict";
  const { svg, html } = window.PM;

  const PLATFORMS = [
    { id: "claude", name: "Claude Code", ver: "2.1.299", color: "var(--doing)", via: "插件市场" },
    { id: "codex", name: "Codex", ver: "0.132.0", color: "var(--ok)", via: "插件市场（兼容 Claude 插件）" },
    { id: "opencode", name: "OpenCode", ver: "1.17.12", color: "var(--blocked)", via: "pm setup opencode" },
    { id: "dsh", name: "DeepSeek Harness", ver: "0.2.1-rc.2", color: "var(--break)", via: "pm setup deepseek" },
  ];
  // 2 = 完整支持，1 = 部分（由 AI 按指令执行），0 = 暂不支持
  const CAPABILITIES = [
    ["技能 pm", [2, 2, 2, 2]],
    ["会话开始注入下一步", [2, 2, 2, 1]],
    ["每轮自动记录 token", [2, 2, 2, 0]],
    ["会话结束自动验收", [2, 2, 1, 1]],
    ["功能层终端确认", [2, 2, 2, 2]],
  ];
  // 0–4：配置核查 / 识别到技能 / 模拟测试 / 真实安装 / 端到端演练
  const VERIFIED = [
    [4, "打包产物端到端演练"],
    [3, "真实安装 + 模拟钩子 + 真实会话记录"],
    [2, "技能被识别 + 插件模拟测试"],
    [1, "配置与源码核对"],
  ];

  const text = (x, y, value, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [value]);
  const marker = (id) => svg("defs", {}, [svg("marker", { id, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink-3)" })])]);

  const renderHub = () => {
    const root = document.getElementById("hub-svg");
    const CX = 260, CY = 165;
    const spots = [[110, 60], [410, 60], [110, 270], [410, 270]];
    PLATFORMS.forEach((p, i) => {
      const [x, y] = spots[i];
      root.appendChild(svg("line", { x1: CX, y1: CY, x2: x, y2: y, stroke: p.color, "stroke-width": 3, "stroke-dasharray": i < 2 ? null : "7 5" }));
      root.appendChild(svg("g", { transform: `translate(${x - 92},${y - 30})` }, [
        svg("rect", { width: 184, height: 60, rx: 12, fill: "var(--card)", stroke: p.color, "stroke-width": 2.4 }),
        text(92, 25, p.name, { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 14 }),
        text(92, 44, p.via, { "text-anchor": "middle", "font-size": 10.5, fill: p.color, "font-weight": 700 }),
      ]));
    });
    root.appendChild(svg("circle", { cx: CX, cy: CY, r: 52, fill: "var(--ink)" }));
    root.appendChild(text(CX, CY - 2, "pm", { "text-anchor": "middle", "font-size": 26, "font-weight": 900, fill: "var(--card)", "font-family": "var(--font-mono)" }));
    root.appendChild(text(CX, CY + 20, "pm.mjs", { "text-anchor": "middle", "font-size": 11, fill: "var(--card)", "font-family": "var(--font-mono)" }));
  };

  const cell = (x, y, level, color) => {
    if (level === 2) return svg("circle", { cx: x, cy: y, r: 13, fill: color });
    if (level === 1) return svg("g", {}, [
      svg("circle", { cx: x, cy: y, r: 13, fill: "none", stroke: color, "stroke-width": 2.4 }),
      svg("path", { d: `M${x},${y - 13} A13,13 0 0 1 ${x},${y + 13} Z`, fill: color }),
    ]);
    return svg("circle", { cx: x, cy: y, r: 13, fill: "none", stroke: color, "stroke-width": 2.4, "stroke-dasharray": "4 3" });
  };

  const renderMatrix = () => {
    const root = document.getElementById("matrix-svg");
    const LABEL_W = 230, COL = (1000 - LABEL_W) / PLATFORMS.length, ROW = 52, TOP = 70;
    const colX = (i) => LABEL_W + COL * (i + 0.5);
    PLATFORMS.forEach((p, i) => {
      root.appendChild(text(colX(i), 30, p.name, { "text-anchor": "middle", "font-weight": 900, fill: "var(--ink)", "font-size": 14 }));
      root.appendChild(text(colX(i), 48, p.ver, { "text-anchor": "middle", "font-size": 11, "font-family": "var(--font-mono)", fill: "var(--ink-3)" }));
    });
    CAPABILITIES.forEach(([label, levels], r) => {
      const y = TOP + r * ROW + 20;
      root.appendChild(svg("rect", { x: 0, y: y - 24, width: 1000, height: 48, rx: 8, fill: r % 2 ? "transparent" : "var(--paper-2)", opacity: 0.6 }));
      root.appendChild(text(16, y + 5, label, { "font-weight": 700, fill: "var(--ink)", "font-size": 13 }));
      levels.forEach((lv, i) => root.appendChild(cell(colX(i), y, lv, PLATFORMS[i].color)));
    });
    const vy = TOP + CAPABILITIES.length * ROW + 30;
    root.appendChild(text(16, vy + 5, "验证程度", { "font-weight": 900, fill: "var(--ink)", "font-size": 13 }));
    VERIFIED.forEach(([level, note], i) => {
      const x0 = colX(i) - 60;
      for (let k = 0; k < 4; k++) {
        root.appendChild(svg("rect", { x: x0 + k * 31, y: vy - 8, width: 27, height: 14, rx: 4, fill: k < level ? PLATFORMS[i].color : "var(--paper-2)" }));
      }
      root.appendChild(text(colX(i), vy + 26, note, { "text-anchor": "middle", "font-size": 10.5 }));
    });
  };

  const CARDS = [
    { p: 0, cmds: ["claude plugin marketplace add wMango/ai-pm", "claude plugin install ai-pm@ai-pm"],
      how: "新开会话，直接说\"帮我初始化项目地图\"\"下一步做什么\"。",
      notes: ["三个钩子自动工作：注入摘要、记 token、后台验收", "也可以用 DeepSeek 模型：ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic"] },
    { p: 1, cmds: ["codex plugin marketplace add wMango/ai-pm", "codex plugin add ai-pm@ai-pm"],
      how: "新开会话，先在 /hooks 里信任三个钩子；用 $pm 或 /skills 调用技能。",
      notes: ["Codex 原生识别 Claude 插件格式，并注入 CLAUDE_PLUGIN_ROOT", "token 取会话记录里 token_count 的累计值并自动换算", "沙箱需允许写项目目录（workspace-write）"] },
    { p: 2, cmds: ["PM setup opencode", "PM setup opencode --global   # 对所有项目生效"],
      how: "和 AI 说\"用 pm 技能……\"；opencode debug skill 可确认技能已加载。",
      notes: ["生成 .opencode/plugins/ai-pm.js 与 .opencode/skills/pm/", "OpenCode 没有会话结束事件：想看最新验收，手动 PM verify && PM dashboard", "注入用的是 OpenCode 的实验性接口"] },
    { p: 3, cmds: ["PM setup deepseek", "dsh web"],
      how: "AI 按 AGENTS.md 的说明，开始时运行 pm context，结束前运行 pm verify / dashboard。",
      notes: ["写入 .agents/skills/pm/ 与 AGENTS.md 中带标记的一段", "token 暂不自动记录（会话记录为压缩格式）", "全局安装会与 Codex 共用 ~/.agents/skills"] },
  ];
  const renderCards = () => {
    const root = document.getElementById("platforms");
    CARDS.forEach((c) => {
      const p = PLATFORMS[c.p];
      root.appendChild(html("article", { class: "card platform" }, [
        html("span", { class: "tag", style: `background:${p.color}` }, [p.via]),
        html("h3", {}, [p.name]),
        ...c.cmds.map((cmd) => html("code", {}, [cmd])),
        html("p", { class: "how" }, [c.how]),
        html("ul", {}, c.notes.map((n) => html("li", {}, [n]))),
      ]));
    });
  };

  const renderOpenCode = () => {
    const root = document.getElementById("oc-svg");
    root.appendChild(marker("oc-arrow"));
    const ROWS = [
      ["每次请求模型前", "experimental.chat.system.transform", "pm hook session-start", "摘要追加到系统提示"],
      ["助手消息完成", "message.updated", "写入 pm-usage 行", "token（推理计入输出）"],
      ["一轮结束", "session.idle", "pm hook stop", "记 token · 刷新地图"],
      ["删除会话", "session.deleted", "pm hook session-end", "后台验收"],
    ];
    ROWS.forEach(([when, ev, action, result], i) => {
      const y = 40 + i * 64;
      root.appendChild(text(16, y + 5, when, { "font-weight": 700, fill: "var(--ink)" }));
      root.appendChild(svg("g", { transform: `translate(150,${y - 20})` }, [
        svg("rect", { width: 270, height: 40, rx: 9, fill: "var(--blocked-tint)", stroke: "var(--blocked)", "stroke-width": 2 }),
        text(135, 25, ev, { "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": 11.5, fill: "var(--ink)" }),
      ]));
      root.appendChild(svg("path", { d: `M424,${y} L486,${y}`, stroke: "var(--ink-3)", "stroke-width": 2, "marker-end": "url(#oc-arrow)" }));
      root.appendChild(svg("g", { transform: `translate(494,${y - 20})` }, [
        svg("rect", { width: 220, height: 40, rx: 9, fill: "var(--ink)" }),
        text(110, 25, action, { "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": 11.5, fill: "var(--card)" }),
      ]));
      root.appendChild(text(730, y + 5, result, { fill: "var(--ok)", "font-weight": 700 }));
    });
  };

  const renderAuto = () => {
    const root = document.getElementById("auto-svg");
    // [人, AI, 自动] 的相对份量
    const SHARES = [[1, 3, 3], [1.4, 3, 3], [1.6, 3, 2.6], [1, 4.2, 0]];
    const LEGEND = [["人：终端按 y（及审核、手动验收）", "var(--ink)"], ["AI：按技能 / 指令执行", "var(--doing)"], ["钩子 / 插件自动完成", "var(--ok)"]];
    const LABEL_W = 170, W = 760;
    SHARES.forEach((parts, i) => {
      const y = 20 + i * 48;
      const total = parts.reduce((a, b) => a + b, 0);
      root.appendChild(text(LABEL_W - 12, y + 18, PLATFORMS[i].name, { "text-anchor": "end", "font-weight": 900, fill: "var(--ink)", "font-size": 13 }));
      let x = LABEL_W;
      parts.forEach((v, k) => {
        const w = (v / Math.max(total, 1)) * W;
        if (w > 0) root.appendChild(svg("rect", { x, y, width: Math.max(w - 3, 0), height: 28, rx: 6, fill: LEGEND[k][1] }));
        x += w;
      });
    });
    LEGEND.forEach(([label, color], k) => {
      root.appendChild(svg("rect", { x: LABEL_W + k * 260, y: 222, width: 14, height: 14, rx: 3, fill: color }));
      root.appendChild(text(LABEL_W + k * 260 + 20, 234, label, { "font-size": 11.5 }));
    });
  };

  window.PM_RENDERERS = [...(window.PM_RENDERERS || []), renderHub, renderMatrix, renderCards, renderOpenCode, renderAuto];
})();
