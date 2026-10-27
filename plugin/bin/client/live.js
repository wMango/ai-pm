// ---------- 实时更新：拿到新数据就原地重绘，保留正在看的视图、视角与选中的模块 ----------
// 两种来源：① 默认，本地文件页定时重新加载同目录的数据脚本，不需要服务器；② pm serve 的推送
const LIVE_TIME = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const LIVE_POLL_MS = 2000;

const liveBadge = (label) => {
  const badge = el("span", { class: "live-badge", role: "status", "aria-live": "polite", "data-state": "on" }, [label]);
  const nav = document.querySelector("nav.jump");
  if (nav) nav.insertBefore(badge, nav.querySelector("a.out"));
  return (text, kind) => { badge.textContent = text; badge.setAttribute("data-state", kind); };
};

/** 换上新数据并重绘；选中的模块如果已经不存在就取消选中 */
const applyLiveData = (live, state, rerender, data) => {
  live.ctx = indexData(data);
  if (state.selected && !live.ctx.data.nodes.some((n) => n.id === state.selected)) state.selected = null;
  rerender();
};

/** ① 本地文件：数据脚本调用 window.__pmLive(版本, 数据)；后台标签页暂停轮询 */
const watchLiveFile = (live, state, rerender, marker) => {
  const file = marker.getAttribute("content");
  let version = marker.getAttribute("data-version");
  const show = liveBadge("● 自动更新");
  window.__pmLive = (next, data) => {
    if (next === version) return;
    version = next;
    try {
      applyLiveData(live, state, rerender, data);
      show(`● 已更新 ${LIVE_TIME.format(new Date())}`, "on");
    } catch (error) {
      show("○ 更新失败", "off");
      console.error(error);
    }
  };
  const poll = () => {
    if (document.hidden) return;
    const script = document.createElement("script");
    script.src = `${file}?t=${Date.now()}`;
    script.onload = () => script.remove();
    script.onerror = () => { script.remove(); show("○ 找不到数据文件，运行 pm dashboard 后恢复", "off"); };
    document.head.appendChild(script);
  };
  poll();
  setInterval(poll, LIVE_POLL_MS);
  document.addEventListener("visibilitychange", poll);
};

/** ② pm serve：收到推送后取 data.json */
const watchLiveServer = (live, state, rerender, marker) => {
  if (typeof EventSource !== "function" || typeof fetch !== "function") return;
  const show = liveBadge("● 实时");
  let version = marker.getAttribute("content");
  const refresh = async (next) => {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyLiveData(live, state, rerender, await res.json());
      version = next;
      show(`● 已更新 ${LIVE_TIME.format(new Date())}`, "on");
    } catch (error) {
      show("○ 读取失败（pm.yaml 有错？）", "off");
      console.error(error);
    }
  };
  const source = new EventSource("events");
  source.addEventListener("update", (e) => { if (e.data !== version) refresh(e.data); });
  source.onopen = () => show("● 实时", "on");
  source.onerror = () => show("○ 连接断开，重试中", "off");
};

/** 离线导出的静态页面两种标记都没有，什么都不做 */
const watchLive = (live, state, rerender) => {
  const server = document.querySelector('meta[name="pm-live"]');
  if (server) return watchLiveServer(live, state, rerender, server);
  const file = document.querySelector('meta[name="pm-live-file"]');
  if (file) watchLiveFile(live, state, rerender, file);
};
