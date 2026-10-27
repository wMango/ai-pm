// pm serve 的本地实时服务：只监听 127.0.0.1、只读；定时检查 .pm 下的输入文件，变化后通过 SSE 推送新版本
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Analysis } from "../analyze.js";
import { analyzeProject } from "../commands/report.js";
import { CommandError } from "../commands/shared.js";
import type { PmPaths } from "../commands/shared.js";
import { renderDashboard, toPlainData } from "../dashboard/render.js";

const LOOPBACK = "127.0.0.1";
/** 决定地图内容的输入；history/index.html 决定有没有"历史"入口 */
const WATCHED = ["pm.yaml", "evidence.json", "ledger.jsonl", "locks.json", "current.json", "history/index.html"] as const;
const DEFAULT_POLL_MS = 1000;
const KEEPALIVE_MS = 15_000;
const RETRY_MS = 2000;
const IDLE_CHECK_MS = 1000;
const ALLOWED_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;
const HISTORY_PAGE = /^\/history\/((?:[0-9a-f]{7,40}|worktree|index)\.html)$/;

const BASE_HEADERS = { "x-content-type-options": "nosniff", "cache-control": "no-store", "referrer-policy": "no-referrer" } as const;

export interface LiveOptions {
  port: number;
  pollMs?: number;
  /** 没有打开的页面、也没有新请求超过这么久就自动关闭；0 表示一直运行 */
  idleMs?: number;
  /** 因无人访问自动关闭后调用 */
  onIdle?: () => void;
}

export interface LiveServer {
  url: string;
  close: () => Promise<void>;
}

/** 文件的修改时间与大小拼成指纹；内容一变版本号就变 */
const fingerprint = (paths: PmPaths): string => {
  const parts = WATCHED.map((name) => {
    const path = paths.file(name);
    if (!existsSync(path)) return `${name}:-`;
    const st = statSync(path);
    return `${name}:${st.mtimeMs}:${st.size}`;
  });
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
};

type Snapshot = { version: string; analysis: Analysis | null; error: string | null };

const snapshotOf = (paths: PmPaths, version: string): Snapshot => {
  try {
    return { version, analysis: analyzeProject(paths, new Date()).analysis, error: null };
  } catch (error: unknown) {
    return { version, analysis: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const send = (res: ServerResponse, status: number, type: string, body: string): void => {
  res.writeHead(status, { ...BASE_HEADERS, "content-type": type });
  res.end(body);
};

export const startLiveServer = (paths: PmPaths, options: LiveOptions): Promise<LiveServer> => {
  let current = snapshotOf(paths, fingerprint(paths));
  const clients = new Set<ServerResponse>();
  const announce = (res: ServerResponse): void => { res.write(`event: update\ndata: ${current.version}\n\n`); };

  const historyLink = (): string | undefined => (existsSync(paths.file("history/index.html")) ? "history/index.html" : undefined);
  const page = (res: ServerResponse): void => {
    if (!current.analysis) return send(res, 500, "text/plain; charset=utf-8", `项目地图暂时无法生成：${current.error ?? "未知错误"}`);
    send(res, 200, "text/html; charset=utf-8", renderDashboard(current.analysis, { history: historyLink(), live: current.version }));
  };
  const data = (res: ServerResponse): void => {
    if (!current.analysis) return send(res, 500, "application/json; charset=utf-8", JSON.stringify({ error: current.error }));
    send(res, 200, "application/json; charset=utf-8", JSON.stringify(toPlainData(current.analysis)));
  };
  const events = (req: IncomingMessage, res: ServerResponse): void => {
    res.writeHead(200, { ...BASE_HEADERS, "content-type": "text/event-stream; charset=utf-8", connection: "keep-alive" });
    res.write(`retry: ${RETRY_MS}\n\n`);
    announce(res);
    clients.add(res);
    req.on("close", () => { clients.delete(res); lastSeen = Date.now(); });
  };
  const historyPage = (res: ServerResponse, name: string): void => {
    const path = paths.file(`history/${name}`);
    if (!existsSync(path)) return send(res, 404, "text/plain; charset=utf-8", "还没有生成提交历史：先运行 pm history");
    send(res, 200, "text/html; charset=utf-8", readFileSync(path, "utf8"));
  };

  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    // 拒绝别的域名指向本机（DNS 重绑定）：浏览器会带上原域名作为 Host
    if (!ALLOWED_HOST.test(req.headers.host ?? "")) return send(res, 403, "text/plain; charset=utf-8", "只接受 127.0.0.1 或 localhost 访问");
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "text/plain; charset=utf-8", "只读服务，只接受 GET");
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/" || path === "/dashboard.html") return page(res);
    if (path === "/data.json") return data(res);
    if (path === "/events") return events(req, res);
    const history = HISTORY_PAGE.exec(path);
    if (history?.[1]) return historyPage(res, history[1]);
    send(res, 404, "text/plain; charset=utf-8", "没有这个页面");
  };

  let lastSeen = Date.now();
  const server = createServer((req, res) => {
    lastSeen = Date.now();
    try {
      handle(req, res);
    } catch (error: unknown) {
      send(res, 500, "text/plain; charset=utf-8", `出错了：${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const poll = setInterval(() => {
    const version = fingerprint(paths);
    if (version === current.version) return;
    current = snapshotOf(paths, version);
    clients.forEach(announce);
  }, options.pollMs ?? DEFAULT_POLL_MS);
  const keepalive = setInterval(() => clients.forEach((res) => res.write(": keepalive\n\n")), KEEPALIVE_MS);

  let closed: Promise<void> | null = null;
  const close = (): Promise<void> => closed ?? (closed = new Promise((resolve) => {
    clearInterval(poll);
    clearInterval(keepalive);
    clearInterval(idleTimer);
    clients.forEach((res) => res.end());
    clients.clear();
    server.closeAllConnections();
    server.close(() => resolve());
  }));
  // 没有打开的页面、也没有新请求时开始计时；页面开着时 SSE 连接一直在，不会退出
  const idleMs = options.idleMs ?? 0;
  const idleTimer = setInterval(() => {
    if (!idleMs || clients.size > 0 || Date.now() - lastSeen < idleMs) return;
    void close().then(() => options.onIdle?.());
  }, Math.min(IDLE_CHECK_MS, Math.max(idleMs / 3, 10)));

  return new Promise((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      clearInterval(poll);
      clearInterval(keepalive);
      clearInterval(idleTimer);
      reject(error.code === "EADDRINUSE"
        ? new CommandError(`端口 ${options.port} 已被占用，用 --port 换一个（例如 pm serve --port ${options.port + 1}）`)
        : error);
    });
    server.listen(options.port, LOOPBACK, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://${LOOPBACK}:${port}/`, close });
    });
  });
};
