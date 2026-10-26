// ---------- ② 依赖与阻塞：哪些未完成模块卡住了最多已写好的模块 ----------
// 卡住同一组模块的根因（通常是一条链）合并成一行，避免重复
const VIEW_DEPTH = { physical: 0, logical: 1, functional: 2 };

const groupRoots = (ctx) => {
  const tally = new Map();
  ctx.data.nodes.filter((n) => n.state === "blocked").forEach((n) =>
    n.rootBlockers.forEach((b) => tally.set(b, [...(tally.get(b) || []), n.id])));
  const groups = new Map();
  tally.forEach((blocked, root) => {
    const key = [...blocked].sort().join("|");
    groups.set(key, { blocked, roots: [...((groups.get(key) || {}).roots || []), root] });
  });
  return [...groups.values()]
    .map((g) => ({ ...g, roots: g.roots.sort((a, b) => VIEW_DEPTH[ctx.node(a).view] - VIEW_DEPTH[ctx.node(b).view] || a.localeCompare(b)) }))
    .sort((a, b) => b.blocked.length - a.blocked.length);
};

const renderBlockers = (ctx) => {
  const root = document.getElementById("blockers");
  const groups = groupRoots(ctx);
  if (!groups.length) {
    root.replaceChildren(emptyState("没有被卡住的模块：已写好的模块都已生效。"));
    return;
  }
  const max = Math.max(...groups.map((g) => g.blocked.length));
  root.replaceChildren(...groups.map((g, i) => el("div", { class: "block-row" }, [
    el("div", {}, [el("div", { class: "row-label" }, [g.roots.length > 1 ? "根因链（先做左边）" : "根因"]), jumpChips(ctx, g.roots)]),
    el("div", {}, [
      svg("svg", { viewBox: "0 0 300 20", preserveAspectRatio: "none", style: "width:100%;height:20px", role: "img", "aria-label": `卡住 ${g.blocked.length} 个模块` }, [
        svg("rect", { width: 300, height: 20, rx: 5, fill: "var(--paper-2)" }),
        svg("rect", { width: (300 * g.blocked.length) / max, height: 20, rx: 5, fill: i === 0 ? "var(--break)" : "var(--blocked)" }),
      ]),
      el("div", { class: "row-label", style: "margin-top:6px" }, [`卡住 ${g.blocked.length} 个已写好的模块`]),
      jumpChips(ctx, g.blocked),
    ]),
  ])));
};
