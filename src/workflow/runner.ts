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
  const result = spawnSync("/bin/sh", ["-c", command], {
    cwd: root,
    env: { ...process.env, [FILE_ENV]: path },
    timeout: timeoutSec * MS_PER_SEC,
    stdio: "ignore",
  });
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    return { ok: false, warning: `${path} 运行超时（${timeoutSec} 秒）` };
  }
  if (result.signal) return { ok: false, warning: `${path} 被信号 ${result.signal} 终止` };
  return { ok: result.status === 0 };
};
