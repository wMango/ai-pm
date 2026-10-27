import { afterEach, describe, expect, test } from "vitest";
import { Window } from "happy-dom";
import { smallProject } from "../commands/helpers.js";
import type { Project } from "../commands/helpers.js";

// 不跑服务器的实时地图：pm dashboard 旁边写一个数据脚本，打开的页面定时重新加载它
let project: Project | null = null;
let window: Window | null = null;
afterEach(async () => {
  await window?.happyDOM.close();
  window = null;
  project?.cleanup();
  project = null;
});

const DATA_FILE = ".pm/dashboard-data.js";
const polled: string[] = [];
const versionIn = (script: string): string => script.match(/__pmLive\("([0-9a-f]+)"/)?.[1] ?? "";

/** 执行数据脚本：把 window.__pmLive 的调用转给页面 */
const deliver = (script: string): void => {
  (window as unknown as { eval: (code: string) => void }).eval(script);
};

const openPage = async (p: Project): Promise<Window["document"]> => {
  window = new Window({ url: "file:///project/.pm/dashboard.html", settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true, disableJavaScriptFileLoading: true } });
  // 记下页面要加载的数据脚本，不真正插入：数据由测试用 deliver() 送达
  polled.length = 0;
  const proto = (window as unknown as { Node: { prototype: { appendChild: (n: unknown) => unknown } } }).Node.prototype;
  const original = proto.appendChild;
  proto.appendChild = function (this: unknown, node: unknown) {
    const src = (node as { getAttribute?: (a: string) => string | null }).getAttribute?.("src");
    if ((node as { tagName?: string }).tagName === "SCRIPT" && src) { polled.push(src); return node; }
    return original.call(this, node);
  };
  window.document.write(p.read(".pm/dashboard.html"));
  // 页面会一直定时轮询，等不到"全部完成"；渲染是同步的，稍等即可
  await new Promise((r) => setTimeout(r, 50));
  return window.document;
};

const click = (target: unknown): void => {
  (target as { dispatchEvent: (e: unknown) => void }).dispatchEvent(new ((window as Window).MouseEvent)("click", { bubbles: true }));
};

describe("live map without a server", () => {
  test("pm dashboard writes a data script next to the page and keeps it out of git", () => {
    project = smallProject();
    expect(project.run(["dashboard"]).code).toBe(0);
    const script = project.read(DATA_FILE);
    expect(script).toMatch(/^window\.__pmLive && window\.__pmLive\("[0-9a-f]{12}", \{/);
    expect(project.read(".pm/dashboard.html")).toContain(`<meta name="pm-live-file" content="dashboard-data.js" data-version="${versionIn(script)}">`);
    expect(project.read(".pm/.gitignore")).toContain("dashboard-data.js");
  });

  test("the version changes only when the project does, not on every regeneration", () => {
    project = smallProject();
    project.run(["dashboard", "--now", "2026-10-27T09:00:00Z"]);
    const first = versionIn(project.read(DATA_FILE));
    project.run(["dashboard", "--now", "2026-10-27T10:00:00Z"]);
    expect(versionIn(project.read(DATA_FILE))).toBe(first);
    project.write(".pm/evidence.json", JSON.stringify({ b: { passed: 1, total: 1 } }));
    project.run(["dashboard", "--now", "2026-10-27T10:00:00Z"]);
    expect(versionIn(project.read(DATA_FILE))).not.toBe(first);
  });

  test("--static leaves out the live hooks, for pages published elsewhere", () => {
    project = smallProject();
    project.run(["dashboard", "--static", "--out", "out/map.html"]);
    const html = project.read("out/map.html");
    expect(html).not.toContain('<meta name="pm-live-file"');
    expect(html).not.toMatch(/script-src[^;]*'self'/);
    expect(() => project?.read("out/map-data.js")).toThrow();
  });

  test("allows only same-folder scripts and never opens a connection", () => {
    project = smallProject();
    project.run(["dashboard"]);
    const html = project.read(".pm/dashboard.html");
    expect(html).toMatch(/script-src 'sha256-[^']+' 'self';/);
    expect(html).not.toMatch(/connect-src/);
  });

  test("the open page polls the data script and redraws in place, keeping the selection", async () => {
    project = smallProject();
    project.run(["dashboard"]);
    const doc = await openPage(project);
    expect(polled.some((src) => /^dashboard-data\.js\?t=\d+$/.test(src))).toBe(true);
    expect(doc.querySelector(".live-badge")?.textContent).toMatch(/自动更新/);
    const stateOf = (id: string): string | null | undefined => doc.querySelector(`#map-svg g.node[data-id="${id}"]`)?.getAttribute("data-state");
    expect(stateOf("b")).not.toBe("ok");
    click(doc.querySelector('#map-svg g.node[data-id="b"]'));
    click(doc.querySelector('button[data-mode="built"]'));

    deliver(project.read(DATA_FILE));
    expect(doc.querySelector(".live-badge")?.textContent).toMatch(/自动更新/);

    project.write(".pm/evidence.json", JSON.stringify({ b: { passed: 1, total: 1 } }));
    project.run(["dashboard"]);
    deliver(project.read(DATA_FILE));
    expect(stateOf("b")).toBe("ok");
    expect(doc.querySelector('button[data-mode="built"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(doc.querySelector("#panel h3")?.textContent).toBe("组件 B");
    expect(doc.querySelector(".live-badge")?.textContent).toMatch(/已更新/);
  });
});
