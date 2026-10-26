// ---------- ③ 目标缺口、下一步推荐、What-if ----------
const REC_LIMIT = 8;
const goalColor = (p) => (p === 100 ? "var(--ok)" : p >= 40 ? "var(--blocked)" : "var(--break)");

const renderGoals = (ctx) => {
  const root = document.getElementById("goals");
  if (!ctx.data.goals.length) {
    root.replaceChildren(el("div", { class: "card" }, [emptyState("还没有目标：在 pm.yaml 的 goals 下声明目标需要哪些节点。")]));
    return;
  }
  const row = (label, ids) => el("div", {}, [el("div", { class: "row-label" }, [label]), jumpChips(ctx, ids, "无")]);
  root.replaceChildren(...ctx.data.goals.map((g) => {
    const p = pct(g.ratio);
    return el("article", { class: "card goal-card" }, [
      el("div", { class: "goal-top" }, [
        ring(p, goalColor(p), 84, `${g.id} 生效进度`),
        el("div", {}, [el("div", { class: "eyebrow" }, [`${g.id} · ${g.effectiveCount}/${g.total} 生效`]), el("h3", {}, [g.name])]),
      ]),
      row("还要建", g.toBuild),
      row("已建但被卡住", g.blocked),
    ]);
  }));
};

const deltaText = (d) => `${d.goal} ${pct(d.before)}% → ${pct(d.after)}%`;

const renderRecs = (ctx) => {
  const root = document.getElementById("recs");
  const recs = ctx.data.recommendations.slice(0, REC_LIMIT);
  const head = el("div", {}, [el("h3", { style: "margin:0" }, ["下一步推荐"]), el("p", { class: "sub" }, ["条长 = 杠杆（每完成一个节点带来的目标提升）。计划包含让它生效还缺的全部节点。"])]);
  if (!recs.length) {
    root.replaceChildren(head, emptyState(ctx.data.goals.length ? "所有目标都已达成，或剩下的模块不影响任何目标。" : "先声明目标，才能给出推荐。"));
    return;
  }
  const max = Math.max(...recs.map((r) => r.leverage), Number.EPSILON);
  root.replaceChildren(head, ...recs.map((r, i) => el("div", { class: "rec-row" }, [
    el("button", { class: "rec-name chip plain", type: "button", "data-jump": r.target, style: "border:0;text-align:left;padding:0;white-space:normal" }, [`${i + 1}. ${ctx.node(r.target).name}`]),
    svg("svg", { viewBox: "0 0 300 20", preserveAspectRatio: "none", style: "width:100%;height:20px", role: "img", "aria-label": `杠杆 ${r.leverage.toFixed(1)}` }, [
      svg("rect", { width: 300, height: 20, rx: 5, fill: "var(--paper-2)" }),
      svg("rect", { width: (300 * r.leverage) / max, height: 20, rx: 5, fill: i === 0 ? "var(--ink)" : "var(--ok)" }),
    ]),
    el("div", { class: "rec-meta" }, [`+${r.gain.toFixed(1)} 个百分点（${r.goalDeltas.map(deltaText).join("；")}）· 计划 ${r.plan.length} 个 · 解锁 ${r.unblocked.length} 个`]),
    el("div", { class: "rec-meta" }, [jumpChips(ctx, r.plan)]),
  ])));
};

const renderWhatIf = (ctx) => {
  const root = document.getElementById("whatif");
  const top = ctx.data.recommendations[0];
  if (!top) {
    root.replaceChildren(el("h3", {}, ["What-if"]), el("p", {}, ["暂无可推演的下一步。"]));
    return;
  }
  const W = 300, BAR_H = 22, ROW = 54;
  const bars = svg("svg", { viewBox: `0 0 ${W} ${top.goalDeltas.length * ROW + 6}`, style: "width:100%;height:auto", role: "img", "aria-label": "完成后的目标变化" });
  top.goalDeltas.forEach((d, i) => {
    const y = 20 + i * ROW;
    bars.appendChild(txt(0, y - 6, d.goal, { fill: "currentColor", "font-weight": 900 }));
    bars.appendChild(svg("rect", { x: 0, y, width: W, height: BAR_H, rx: 11, fill: "rgba(255,255,255,.14)" }));
    bars.appendChild(svg("rect", { x: 0, y, width: W * d.after, height: BAR_H, rx: 11, fill: "var(--ok)" }));
    bars.appendChild(svg("rect", { x: 0, y, width: W * d.before, height: BAR_H, rx: 11, fill: "var(--blocked)" }));
    bars.appendChild(txt(W, y - 6, `${pct(d.before)}% → ${pct(d.after)}%`, { "text-anchor": "end", fill: "currentColor", "font-family": "var(--font-mono)", "font-weight": 700 }));
  });
  const freed = top.unblocked.filter((id) => ctx.node(id).status === "done");
  root.replaceChildren(
    el("div", { class: "eyebrow", style: "color:inherit;opacity:.6" }, ["推荐第一 · What-if"]),
    el("h3", {}, [top.plan.map((id) => ctx.node(id).name).join(" + ")]),
    el("p", {}, [freed.length ? `做完后，${freed.length} 个已写好的模块立即生效：${freed.map((id) => ctx.node(id).name).join("、")}。` : `做完后新增 ${top.unblocked.length} 个生效节点。`]),
    bars,
  );
};
