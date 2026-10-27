import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadPmYaml, parseEvidence, parseLedger } from "../load.js";
import type { Evidence, LedgerEntry, PmModel } from "../schema.js";
import { allNodes } from "../graph.js";
import { isPendingReview, parseLocks } from "../workflow/locks.js";

export interface CliIo {
  cwd: string;
  out: (text: string) => void;
  err: (text: string) => void;
  /** 读取标准输入（hook 用）；测试里可以注入 */
  readStdin?: () => string;
  /** 是否有人在真实终端前（标准输入和输出都连着终端）；AI 通过工具运行命令时为 false */
  isInteractive?: () => boolean;
  /** 在终端里向人提问，返回输入的一行；无法提问时返回 null */
  prompt?: (question: string) => string | null;
}

export type Command = (args: readonly string[], io: CliIo) => number;

export const EXIT = { ok: 0, failed: 1, usage: 2 } as const;

/** 用法错误：退出码 2 */
export class UsageError extends Error {}
/** 输入或环境有误：退出码 1 */
export class CommandError extends Error {}

export interface ParsedArgs {
  positionals: string[];
  options: Record<string, string>;
  flags: Set<string>;
}

/** 解析 --key value、--flag 和位置参数；未声明的选项一律视为用法错误 */
export const parseArgs = (args: readonly string[], spec: { options?: readonly string[]; flags?: readonly string[] }): ParsedArgs => {
  const positionals: string[] = [];
  const options: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
    } else if (spec.flags?.includes(arg)) {
      flags.add(arg);
    } else if (spec.options?.includes(arg)) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) throw new UsageError(`${arg} 缺少值`);
      options[arg] = value;
      i++;
    } else {
      throw new UsageError(`未知参数 ${arg}`);
    }
  }
  return { positionals, options, flags };
};

export interface PmPaths {
  pmDir: string;
  /** 项目根目录：.pm 的上一级；验收测试路径都相对于它 */
  root: string;
  file: (name: string) => string;
}

export const pmPaths = (cwd: string, dir = ".pm"): PmPaths => {
  const pmDir = resolve(cwd, dir);
  return { pmDir, root: dirname(pmDir), file: (name) => resolve(pmDir, name) };
};

export const isManaged = (paths: PmPaths): boolean => existsSync(paths.file("pm.yaml"));

export const readOptional = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);

/** 先写临时文件再改名：并发读取时不会读到写了一半的内容 */
export const writeFileEnsured = (path: string, content: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
};

export const writeJson = (path: string, data: unknown): void => writeFileEnsured(path, `${JSON.stringify(data, null, 2)}\n`);

export const loadModel = (paths: PmPaths): { model: PmModel; warnings: string[] } => {
  const text = readOptional(paths.file("pm.yaml"));
  if (text === null) throw new CommandError(`找不到 ${paths.file("pm.yaml")}（先运行 pm init）`);
  const loaded = loadPmYaml(text);
  if (!loaded.ok) throw new CommandError(`pm.yaml 无效：\n${loaded.errors.map((e) => `  - ${e}`).join("\n")}`);
  return { model: loaded.model, warnings: loaded.warnings };
};

export const readEvidence = (paths: PmPaths): Evidence => {
  const text = readOptional(paths.file("evidence.json"));
  if (text === null) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CommandError("evidence.json 不是合法 JSON");
  }
  return parseEvidence(raw);
};

/** 容错读取：坏行跳过并给出警告，不拖垮页面、上下文和记账 */
export const readLedger = (paths: PmPaths): { entries: LedgerEntry[]; warnings: string[] } => {
  const text = readOptional(paths.file("ledger.jsonl"));
  if (text === null) return { entries: [], warnings: [] };
  const warnings: string[] = [];
  const entries = text.split("\n").flatMap((line, i) => {
    if (!line.trim()) return [];
    try {
      return parseLedger(line);
    } catch {
      warnings.push(`ledger 第 ${i + 1} 行无法解析，已跳过`);
      return [];
    }
  });
  return { entries, warnings };
};

/** 当前声明的模块（pm start 写入） */
export const readCurrentNode = (paths: PmPaths): string | null => {
  const text = readOptional(paths.file("current.json"));
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && typeof (parsed as { node?: unknown }).node === "string" ? (parsed as { node: string }).node : null;
  } catch {
    return null;
  }
};

export const findNode = (model: PmModel, id: string): { view: "functional" | "logical" | "physical"; node: PmModel["views"]["logical"][number] | PmModel["views"]["functional"][number] } => {
  for (const view of ["functional", "logical", "physical"] as const) {
    const node = model.views[view].find((n) => n.id === id);
    if (node) return { view, node };
  }
  throw new CommandError(`找不到节点 ${id}`);
};

/** 从 start 向上查找含 .pm/pm.yaml 的目录；找不到返回 null */
export const findPmPaths = (start: string): PmPaths | null => {
  let dir = resolve(start);
  for (;;) {
    const paths = pmPaths(dir);
    if (isManaged(paths)) return paths;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 5_000;
const LOCK_POLL_MS = 50;
const sleepSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

/** 用 mkdir 做跨进程互斥：Stop 钩子与会话结束的后台进程可能同时记账 */
export const withPmLock = <T>(paths: PmPaths, fn: () => T): T => {
  const lockDir = paths.file(".lock");
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const age = Date.now() - statSync(lockDir).mtimeMs;
      if (age > LOCK_STALE_MS) rmSync(lockDir, { recursive: true, force: true });
      else if (Date.now() > deadline) throw new CommandError("等待 .pm/.lock 超时，可能有另一个 pm 进程卡住了");
      else sleepSync(LOCK_POLL_MS);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
};

const GITIGNORE_ENTRIES = ["current.json", "last-run.log", "trusted-runners", ".lock", "*.tmp", "history/"];

/** 确保 .pm/.gitignore 里有本机文件，不覆盖用户已有的条目 */
export const ensureGitignore = (paths: PmPaths): void => {
  const existing = readOptional(paths.file(".gitignore")) ?? "";
  const lines = existing.split("\n").filter(Boolean);
  const missing = GITIGNORE_ENTRIES.filter((e) => !lines.includes(e));
  if (missing.length) writeFileEnsured(paths.file(".gitignore"), `${[...lines, ...missing].join("\n")}\n`);
};

/** runners 与超时一起决定了"运行什么"，指纹变了就要重新信任 */
export const runnersFingerprint = (model: PmModel): string => {
  const { runners, testTimeoutSec } = model.settings;
  const canonical = JSON.stringify({ runners: Object.fromEntries(Object.entries(runners).sort()), testTimeoutSec });
  return createHash("sha256").update(canonical).digest("hex");
};

/** 信任记录只存本机（已 gitignore），别人改了 runners 不会自动被信任 */
export const isRunnersTrusted = (paths: PmPaths, model: PmModel): boolean =>
  (readOptional(paths.file("trusted-runners")) ?? "").trim() === runnersFingerprint(model);

export const trustRunners = (paths: PmPaths, model: PmModel): void => {
  writeFileEnsured(paths.file("trusted-runners"), `${runnersFingerprint(model)}\n`);
  ensureGitignore(paths);
};

/** 待复核实时计算（不依赖上次 verify 的快照），会话中途改测试也能立刻看到 */
export const withLiveReview = (paths: PmPaths, model: PmModel, evidence: Evidence): Evidence => {
  const locks = parseLocks(readOptional(paths.file("locks.json")));
  const live = allNodes(model)
    .filter(({ node }) => node.spec || node.acceptance.length)
    .map(({ node, view }) => {
      const prev = evidence[node.id] ?? { passed: 0, total: 0, pendingReview: false };
      const pendingReview = isPendingReview(paths.root, node, locks[node.id], model.settings.runners, view === "functional");
      return [node.id, { ...prev, pendingReview }] as const;
    });
  return { ...evidence, ...Object.fromEntries(live) };
};
