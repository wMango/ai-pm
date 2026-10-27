// ---------- 通用工具（所有用户数据都通过 textContent / setAttribute 写入，绝不拼 HTML） ----------
const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_LABEL = { functional: "功能", logical: "逻辑", physical: "物理" };
const LAYER_LABEL = { front: "前端层", service: "服务层", data: "数据层", external: "外部" };
const STATE_META = {
  todo: { label: "未建", color: "var(--todo)", tint: "var(--todo-tint)", dashed: true },
  doing: { label: "进行中", color: "var(--doing)", tint: "var(--doing-tint)", dashed: true },
  blocked: { label: "已建未生效", color: "var(--blocked)", tint: "var(--blocked-tint)", dashed: false },
  ok: { label: "已生效", color: "var(--ok)", tint: "var(--ok-tint)", dashed: false },
};

const append = (node, children) => {
  children.filter((c) => c !== null && c !== undefined && c !== false)
    .forEach((c) => node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c));
  return node;
};
/** 清空后再放入子节点；和 append 一样跳过 null，避免 replaceChildren 把 null 显示成文字 */
const fill = (node, children) => { node.replaceChildren(); return append(node, children); };
const svg = (tag, attrs = {}, children = []) => {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined && v !== null) node.setAttribute(k, String(v)); });
  return append(node, children);
};
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined && v !== null) node.setAttribute(k, String(v)); });
  return append(node, children);
};
const txt = (x, y, value, extra = {}) => svg("text", { x, y, "font-size": 12, fill: "var(--ink-2)", ...extra }, [value]);
const chip = (label, kind = "plain", attrs = {}) => el(attrs["data-jump"] ? "button" : "span", { class: `chip ${kind}`, type: attrs["data-jump"] ? "button" : undefined, ...attrs }, [label]);
const emptyState = (message) => el("div", { class: "empty" }, [message]);

const ring = (pct, color, size, label) => {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return svg("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: "img", "aria-label": label }, [
    svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--paper-2)", "stroke-width": 9 }),
    svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: color, "stroke-width": 9, "stroke-linecap": "round",
      "stroke-dasharray": `${(c * pct) / 100} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }),
    svg("text", { x: size / 2, y: size / 2 + size / 14, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-weight": 700, "font-size": size / 4.6, fill: "var(--ink)" }, [`${pct}%`]),
  ]);
};
const arrowMarker = (id, color) => svg("marker", { id, viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, [svg("path", { d: "M0,0 L10,5 L0,10 z", fill: color })]);

const pct = (ratio) => Math.round(ratio * 100);
const wan = (tokens) => `${Number((tokens / 10000).toFixed(tokens % 10000 ? 1 : 0))} 万`;
/** 名字过长时截断，完整名字放在 <title> 里 */
const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** 读取并索引内嵌数据 */
const loadData = () => {
  const data = JSON.parse(document.getElementById("pm-data").textContent);
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const node = (id) => byId.get(id) || { id, name: id, state: "todo", view: "logical", goals: [], rootBlockers: [] };
  const depsOf = (id) => data.edges.filter((e) => e.from === id && (e.kind === "hard" || e.kind === "soft"));
  const dependentsOf = (id) => data.edges.filter((e) => e.to === id && (e.kind === "hard" || e.kind === "soft"));
  const supportsOf = (id) => data.edges.filter((e) => e.from === id && e.kind !== "hard" && e.kind !== "soft");
  const supportedBy = (id) => data.edges.filter((e) => e.to === id && e.kind !== "hard" && e.kind !== "soft");
  return { data, node, depsOf, dependentsOf, supportsOf, supportedBy };
};
