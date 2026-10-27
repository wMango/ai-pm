import { afterEach, describe, expect, test } from "vitest";
import { Window } from "happy-dom";
import { pmPaths } from "../../src/commands/shared.js";
import { startLiveServer } from "../../src/live/server.js";
import type { LiveServer } from "../../src/live/server.js";
import { renderDashboard } from "../../src/index.js";
import { DEMO_NOW, loadDemo } from "../helpers.js";
import { analyze } from "../../src/index.js";
import { smallProject } from "../commands/helpers.js";
import type { Project } from "../commands/helpers.js";

// 在无头 DOM 里跑实时页：用假的 EventSource 模拟推送，fetch 转给真实的本地服务
let project: Project | null = null;
let server: LiveServer | null = null;
let window: Window | null = null;
afterEach(async () => {
  await window?.happyDOM.close();
  window = null;
  await server?.close();
  server = null;
  project?.cleanup();
  project = null;
});

class FakeEventSource {
  static last: FakeEventSource | null = null;
  readonly listeners = new Map<string, ((e: { data: string }) => void)[]>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) { FakeEventSource.last = this; }
  addEventListener(type: string, fn: (e: { data: string }) => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  emit(type: string, data: string): void { (this.listeners.get(type) ?? []).forEach((fn) => fn({ data })); }
  close(): void {}
}

const openLive = async (live: LiveServer): Promise<Window["document"]> => {
  const html = await (await fetch(live.url)).text();
  window = new Window({ url: live.url, settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  const w = window as unknown as Record<string, unknown>;
  w.EventSource = FakeEventSource;
  w.fetch = (path: string) => fetch(new URL(path, live.url));
  window.document.write(html);
  await window.happyDOM.waitUntilComplete();
  return window.document;
};

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 10));
};

const click = (target: unknown): void => {
  (target as { dispatchEvent: (e: unknown) => void }).dispatchEvent(new ((window as Window).MouseEvent)("click", { bubbles: true }));
};

describe("live map page", () => {
  test("redraws in place on an update and keeps what the user was looking at", async () => {
    project = smallProject();
    server = await startLiveServer(pmPaths(project.root), { port: 0, pollMs: 40 });
    const doc = await openLive(server);
    expect(doc.querySelector(".live-badge")?.textContent).toMatch(/实时/);
    const stateOf = (id: string): string | null | undefined => doc.querySelector(`#map-svg g.node[data-id="${id}"]`)?.getAttribute("data-state");
    expect(stateOf("b")).not.toBe("ok");
    click(doc.querySelector('#map-svg g.node[data-id="b"]'));
    click(doc.querySelector('button[data-mode="built"]'));

    project.write(".pm/evidence.json", JSON.stringify({ b: { passed: 1, total: 1 } }));
    await new Promise((r) => setTimeout(r, 200));
    FakeEventSource.last?.emit("update", "v2");
    await settle();

    expect(stateOf("b")).toBe("ok");
    expect(doc.querySelector('button[data-mode="built"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(doc.querySelector("#panel h3")?.textContent).toBe("组件 B");
    expect(doc.querySelector(".live-badge")?.textContent).toMatch(/已更新|实时/);
  });

  test("the offline file has no live hooks", async () => {
    const { model, evidence, ledger } = loadDemo();
    const html = renderDashboard(analyze(model, { evidence, ledger, now: DEMO_NOW }));
    expect(html).not.toContain('<meta name="pm-live"');
    expect(html).not.toMatch(/connect-src/);
  });
});
