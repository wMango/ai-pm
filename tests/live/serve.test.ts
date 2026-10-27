import { afterEach, describe, expect, test } from "vitest";
import { request } from "node:http";
import { pmPaths } from "../../src/commands/shared.js";
import { startLiveServer } from "../../src/live/server.js";
import type { LiveServer } from "../../src/live/server.js";
import { makeProject, smallProject } from "../commands/helpers.js";
import type { Project } from "../commands/helpers.js";

let project: Project | null = null;
let server: LiveServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
  project?.cleanup();
  project = null;
});

const POLL_MS = 40;
const start = async (): Promise<LiveServer> => {
  project = smallProject();
  server = await startLiveServer(pmPaths(project.root), { port: 0, pollMs: POLL_MS });
  return server;
};

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** 用 node:http 发请求：fetch 不允许改 Host 头 */
const get = (live: LiveServer, path: string, init: { method?: string; host?: string } = {}): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const { port } = new URL(live.url);
    const req = request({ host: "127.0.0.1", port, path, method: init.method ?? "GET", headers: init.host ? { host: init.host } : {} }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });

/** 读 /events，直到收到满足条件的事件 */
const waitForEvent = (live: LiveServer, match: (event: string, data: string) => boolean, onOpen?: () => void): Promise<string> =>
  new Promise((resolve, reject) => {
    const { port } = new URL(live.url);
    const timer = setTimeout(() => { req.destroy(); reject(new Error("等待推送超时")); }, 4000);
    const req = request({ host: "127.0.0.1", port, path: "/events" }, (res) => {
      let buffer = "";
      res.setEncoding("utf8");
      onOpen?.();
      res.on("data", (chunk: string) => {
        buffer += chunk;
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const event = block.match(/^event: (.*)$/m)?.[1] ?? "message";
          const data = block.match(/^data: (.*)$/m)?.[1] ?? "";
          if (match(event, data)) { clearTimeout(timer); req.destroy(); resolve(data); return; }
        }
      });
    });
    req.on("error", (error) => { if (!req.destroyed) reject(error); });
    req.end();
  });

describe("pm serve", () => {
  test("listens on loopback only and serves the live map", async () => {
    const live = await start();
    expect(new URL(live.url).hostname).toBe("127.0.0.1");
    const page = await get(live, "/");
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toMatch(/text\/html/);
    expect(page.body).toContain('<meta name="pm-live"');
    expect(page.body).toMatch(/connect-src 'self'/);
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    expect(page.headers["cache-control"]).toBe("no-store");
  });

  test("serves the current analysis as JSON", async () => {
    const live = await start();
    const data = await get(live, "/data.json");
    expect(data.status).toBe(200);
    expect(JSON.parse(data.body).nodes.map((n: { id: string }) => n.id).sort()).toEqual(["a", "b", "f"]);
  });

  test("rejects other hosts, other methods and any other path", async () => {
    const live = await start();
    expect((await get(live, "/", { host: "evil.example.com" })).status).toBe(403);
    expect((await get(live, "/", { method: "POST" })).status).toBe(405);
    for (const path of ["/pm.yaml", "/../pm.yaml", "/history/../pm.yaml", "/history/x.js", "/%2e%2e/pm.yaml"]) {
      expect((await get(live, path)).status).toBe(404);
    }
  });

  test("serves generated history pages", async () => {
    const live = await start();
    expect((await get(live, "/history/index.html")).status).toBe(404);
    project?.write(".pm/history/index.html", "<!doctype html><title>历史</title>");
    const page = await get(live, "/history/index.html");
    expect(page.status).toBe(200);
    expect(page.body).toContain("历史");
  });

  test("pushes a new version when the project changes", async () => {
    const live = await start();
    const first = await waitForEvent(live, (event) => event === "update");
    const next = waitForEvent(live, (event, data) => event === "update" && data !== first, () => {
      setTimeout(() => project?.write(".pm/evidence.json", JSON.stringify({ b: { passed: 1, total: 1 } })), POLL_MS * 2);
    });
    await expect(next).resolves.not.toBe(first);
    const data = JSON.parse((await get(live, "/data.json")).body);
    expect(data.nodes.find((n: { id: string }) => n.id === "b").status).toBe("done");
  });

  test("explains a port that is already taken", async () => {
    const live = await start();
    const { port } = new URL(live.url);
    await expect(startLiveServer(pmPaths(project?.root ?? ""), { port: Number(port), pollMs: POLL_MS })).rejects.toThrow(/--port/);
  });

  test("shuts itself down after a quiet period with nobody watching", async () => {
    project = smallProject();
    let idle = false;
    server = await startLiveServer(pmPaths(project.root), { port: 0, pollMs: POLL_MS, idleMs: 150, onIdle: () => { idle = true; } });
    await get(server, "/");
    await new Promise((r) => setTimeout(r, 400));
    expect(idle).toBe(true);
    await expect(get(server, "/")).rejects.toThrow();
    server = null;
  });

  test("stays up while a page is open", async () => {
    project = smallProject();
    let idle = false;
    const live = await startLiveServer(pmPaths(project.root), { port: 0, pollMs: POLL_MS, idleMs: 150, onIdle: () => { idle = true; } });
    server = live;
    const { port } = new URL(live.url);
    const watcher = request({ host: "127.0.0.1", port, path: "/events" });
    watcher.on("error", () => undefined);
    watcher.end();
    await new Promise((r) => setTimeout(r, 400));
    expect(idle).toBe(false);
    watcher.destroy();
    await new Promise((r) => setTimeout(r, 400));
    expect(idle).toBe(true);
    server = null;
  });

  test("pm serve checks its arguments before starting", () => {
    project = smallProject();
    expect(project.run(["serve", "--port", "abc"]).code).toBe(2);
    expect(project.run(["serve", "--port", "70000"]).code).toBe(2);
    expect(project.run(["serve", "--idle-minutes", "-1"]).code).toBe(2);
    const bare = makeProject();
    try {
      const run = bare.run(["serve"]);
      expect(run.code).toBe(1);
      expect(run.err).toMatch(/pm init/);
    } finally {
      bare.cleanup();
    }
  });
});
