// ---------- 入口：页头、交互绑定、逐个视图渲染（单个视图出错不影响其他视图） ----------
const renderHeader = (ctx) => {
  const { data } = ctx;
  document.getElementById("project-name").textContent = data.project;
  document.getElementById("generated-at").textContent = `生成于 ${new Date(data.generatedAt).toLocaleString("zh-CN")}`;
  const { total, built, effective } = data.metrics;
  const ratio = (n) => (total ? pct(n / total) : 0);
  document.getElementById("metrics").replaceChildren(
    el("div", { class: "metric" }, [ring(ratio(built), "var(--ink)", 86, "建成度"), el("b", {}, ["建成度"]), `${built}/${total} 已完成`]),
    el("div", { class: "metric" }, [ring(ratio(effective), "var(--ok)", 86, "生效度"), el("b", {}, ["生效度"]), `${effective}/${total} 真正可用`]),
  );
  document.getElementById("warnings").replaceChildren(...data.warnings.map((w) => el("div", { class: "warning" }, [`警告：${w}`])));
  document.getElementById("legend").replaceChildren(...Object.values(STATE_META).map((m) =>
    el("span", {}, [el("i", { style: `background:${m.tint};border-color:${m.color};border-style:${m.dashed ? "dashed" : "solid"}` }), m.label])));
};

const initialView = (ctx) => ["logical", "functional", "physical"].find((v) => ctx.data.nodes.some((n) => n.view === v)) || "logical";

const bindInteractions = (ctx, state) => {
  const focusNode = (id) => {
    const target = [...document.querySelectorAll("#map-svg g.node")].find((g) => g.getAttribute("data-id") === id);
    if (target) target.focus({ preventScroll: true });
  };
  /** 重绘会替换节点，键盘焦点要找回原来的节点 */
  const redraw = () => {
    const active = document.activeElement;
    const focusedId = active && active.closest && active.closest("#map-svg") ? active.getAttribute("data-id") : null;
    renderMap(ctx, state);
    renderPanel(ctx, state);
    if (focusedId) focusNode(focusedId);
  };
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const select = (id) => {
    state.view = ctx.node(id).view;
    state.selected = id;
    redraw();
    document.getElementById("map-section").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    focusNode(id);
  };
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { state.view = b.getAttribute("data-view"); redraw(); }));
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { state.mode = b.getAttribute("data-mode"); redraw(); }));
  const mapSvg = document.getElementById("map-svg");
  const pickOnMap = (target) => {
    const g = target.closest && target.closest("g.node[data-id]");
    const id = g ? g.getAttribute("data-id") : null;
    state.selected = id && id !== state.selected ? id : null;
    redraw();
  };
  mapSvg.addEventListener("click", (e) => pickOnMap(e.target));
  const activate = (e) => {
    const jump = e.target.closest && e.target.closest("[data-jump]");
    if (jump) { e.preventDefault(); select(jump.getAttribute("data-jump")); return; }
    if (e.type === "keydown" && mapSvg.contains(e.target)) { e.preventDefault(); pickOnMap(e.target); }
  };
  document.addEventListener("click", (e) => { if (!mapSvg.contains(e.target)) activate(e); });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") activate(e); });
};

const reportError = (name, error) => {
  const note = el("p", { class: "render-error" }, [`视图渲染出错（${name}）：${error && error.message ? error.message : String(error)}`]);
  document.querySelector("main").prepend(note);
  console.error(error);
};

const boot = () => {
  let ctx;
  try {
    ctx = loadData();
  } catch (error) {
    reportError("数据", error);
    return;
  }
  const state = { view: initialView(ctx), mode: "effective", selected: null };
  const steps = [
    ["页头", () => renderHeader(ctx)],
    ["架构地图", () => { renderMap(ctx, state); renderPanel(ctx, state); bindInteractions(ctx, state); }],
    ["依赖与阻塞", () => renderBlockers(ctx)],
    ["目标", () => renderGoals(ctx)],
    ["下一步", () => { renderRecs(ctx); renderWhatIf(ctx); }],
    ["成本", () => renderCost(ctx)],
    ["旅程蓝图", () => renderBlueprints(ctx)],
  ];
  steps.forEach(([name, run]) => { try { run(); } catch (error) { reportError(name, error); } });
};

boot();
