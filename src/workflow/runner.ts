import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface RunResult {
  ok: boolean;
  warning?: string;
}

const MS_PER_SEC = 1000;
/** {file} 连同模板里可能包裹它的引号一起替换，例如 bash "{file}"、bash '{file}' */
const FILE_PLACEHOLDER = /(["']?)\{file\}\1/g;
/** 路径通过环境变量传给 shell，"$PM_FILE" 展开后不会再被解释，杜绝注入 */
const FILE_ENV = "PM_FILE";
/** 验收嵌套层数随子进程传递；不论项目根目录是谁，超过上限就拒绝，防止跨项目递归 */
const VERIFY_DEPTH_ENV = "AI_PM_VERIFY_DEPTH";
/** 0 层是用户/钩子发起的验收，1 层是验收测试里对临时项目的验收，再深一律拒绝 */
export const MAX_VERIFY_DEPTH = 2;

export const verifyDepth = (): number => {
  const depth = Number(process.env[VERIFY_DEPTH_ENV]);
  return Number.isInteger(depth) && depth > 0 ? depth : 0;
};

// 同步 CLI 的超时管理放到独立 Node 监督进程里。只杀 shell 会留下 npm/Vitest；
// 监督进程在超时、正常结束或父进程消失时清理该命令独占的 POSIX 进程组。
const SUPERVISOR = String.raw`
const { spawn } = require('node:child_process');
const parent = process.ppid;
const child = spawn('/bin/sh', ['-c', process.argv[1]], { detached: true, stdio: 'ignore' });
if (child.pid) process.stdout.write(JSON.stringify({ pid: child.pid }) + '\n');
let done = false;
let timer, parentWatch;
const killTree = () => {
  if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
};
const finish = (result) => {
  if (done) return;
  done = true;
  clearTimeout(timer);
  clearInterval(parentWatch);
  killTree();
  process.stdout.write(JSON.stringify(result) + '\n');
};
child.on('error', (error) => finish({ error: error.message }));
child.on('exit', (status, signal) => finish({ status, signal }));
timer = setTimeout(() => finish({ timedOut: true }), Number(process.argv[2]));
parentWatch = setInterval(() => {
  if (process.ppid !== parent) finish({ error: '验收父进程已退出' });
}, 100);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => finish({ signal }));
}
`;

/** 按最长后缀匹配运行器，例如 .test.ts 优先于 .ts */
export const runnerFor = (path: string, runners: Record<string, string>): { suffix: string; command: string } | null => {
  const match = Object.keys(runners)
    .filter((suffix) => path.endsWith(suffix))
    .sort((a, b) => b.length - a.length)[0];
  return match ? { suffix: match, command: runners[match] as string } : null;
};

const extensionOf = (path: string): string => {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : name;
};

/** 运行一个验收测试文件；退出码 0 即通过 */
export const runAcceptance = (root: string, path: string, runners: Record<string, string>, timeoutSec: number): RunResult => {
  if (!existsSync(resolve(root, path))) return { ok: false, warning: `${path} 不存在` };
  const runner = runnerFor(path, runners);
  if (!runner) return { ok: false, warning: `没有为 ${extensionOf(path)} 配置运行器（settings.runners），${path} 未运行` };
  const command = runner.command.replace(FILE_PLACEHOLDER, `"$${FILE_ENV}"`);
  const result = spawnSync(process.execPath, ["--input-type=commonjs", "-e", SUPERVISOR, command, String(timeoutSec * MS_PER_SEC)], {
    cwd: root,
    env: { ...process.env, [FILE_ENV]: path, AI_PM_VERIFY_ROOT: resolve(root), [VERIFY_DEPTH_ENV]: String(verifyDepth() + 1) },
    timeout: timeoutSec * MS_PER_SEC + 5_000,
    killSignal: "SIGKILL",
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024,
  });
  const messages = (result.stdout ?? "").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) as {
    pid?: number; status?: number | null; signal?: string | null; timedOut?: boolean; error?: string;
  }[];
  // 若监督进程自身超时，仍利用启动时记录的组号兜底清理。
  const pid = messages[0]?.pid;
  if (pid) {
    try { process.kill(-pid, "SIGKILL"); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  const outcome = messages[messages.length - 1];
  if (outcome?.timedOut || (result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") {
    return { ok: false, warning: `${path} 运行超时（${timeoutSec} 秒）` };
  }
  if (result.error || outcome?.error) return { ok: false, warning: `${path} 无法运行：${outcome?.error ?? result.error?.message}` };
  if (outcome?.signal || result.signal) return { ok: false, warning: `${path} 被信号 ${outcome?.signal ?? result.signal} 终止` };
  return { ok: result.status === 0 && outcome?.status === 0 };
};
