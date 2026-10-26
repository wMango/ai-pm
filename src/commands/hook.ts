// pm hook <session-start|stop|session-end>：Claude Code 钩子入口。永远返回 0，绝不打断会话。
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { EXIT, UsageError, findPmPaths, isRunnersTrusted, loadModel, parseArgs, writeJson } from "./shared.js";
import type { Command, CliIo, PmPaths } from "./shared.js";
import { recordSession } from "./record.js";
import { runVerify } from "./verify.js";
import { contextText, writeDashboard } from "./report.js";

const payloadSchema = z.object({
  session_id: z.string().min(1).optional(),
  transcript_path: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
});
type Payload = z.infer<typeof payloadSchema>;

const EVENTS = ["session-start", "stop", "session-end"] as const;
type HookEvent = (typeof EVENTS)[number];

const parsePayload = (text: string): Payload => {
  let raw: unknown;
  try {
    raw = JSON.parse(text || "{}");
  } catch {
    throw new Error("hook 输入不是合法 JSON");
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) throw new Error("hook 输入缺少必要字段");
  return parsed.data;
};

const appendLog = (paths: PmPaths, title: string, lines: readonly string[]): void =>
  appendFileSync(paths.file("last-run.log"), `[${new Date().toISOString()}] ${title}\n${lines.map((l) => `  ${l}`).join("\n")}\n`);

/** 记录本次会话 token（有 session 与 transcript 时） */
const recordFromPayload = (paths: PmPaths, payload: Payload): { warnings: string[]; note: string } => {
  if (!payload.session_id || !payload.transcript_path) {
    return { warnings: ["hook 输入里没有 session_id / transcript_path，跳过 token 记录"], note: "未记录 token" };
  }
  const { model } = loadModel(paths);
  const result = recordSession(paths, model, payload.session_id, payload.transcript_path, new Date());
  return { warnings: result.warnings, note: result.entry ? `记录 token ${result.entry.tokens} → ${result.entry.node}` : "没有新增 token" };
};

/** 会话结束的完整流程：记 token → 跑验收（仅当 runners 已被本机信任）→ 刷新页面 */
const sessionEndWork = (paths: PmPaths, payload: Payload): void => {
  const recorded = recordFromPayload(paths, payload);
  const { model } = loadModel(paths);
  const lines = [...recorded.warnings, recorded.note];
  if (isRunnersTrusted(paths, model)) {
    const verified = runVerify(paths, model, null);
    writeJson(paths.file("evidence.json"), verified.evidence);
    lines.push(...verified.warnings, `验收 ${verified.lines.length} 个节点`);
  } else {
    lines.push("runners 配置未被信任（新克隆的仓库或 runners 被改过），本次没有自动跑验收；确认命令无误后运行 pm trust");
  }
  const { analysis } = writeDashboard(paths, new Date());
  lines.push(`已刷新 dashboard：已完成 ${analysis.metrics.built}，已生效 ${analysis.metrics.effective}/${analysis.metrics.total}`);
  appendLog(paths, "会话结束", lines);
};

/** SessionEnd 钩子只有约 1.5 秒：把工作交给脱离的后台进程，载荷经管道传入，立即返回 */
const spawnSessionEnd = (paths: PmPaths, payload: Payload, io: CliIo): void => {
  const entry = process.argv[1];
  if (!entry) throw new Error("无法定位 pm 入口脚本，后台任务未启动");
  const child = spawn(process.execPath, [...process.execArgv, resolve(entry), "hook", "session-end", "--sync"], {
    cwd: paths.root,
    detached: true,
    stdio: ["pipe", "ignore", "ignore"],
  });
  child.on("error", (error) => io.err(`pm hook session-end：后台任务启动失败：${error.message}\n`));
  child.stdin?.end(JSON.stringify({ ...payload, cwd: paths.root }));
  child.unref();
};

/** 优先使用 Claude Code 提供的项目目录，其次从 cwd 向上查找 .pm/ */
const locate = (payload: Payload, io: CliIo): PmPaths | null => {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  return (fromEnv ? findPmPaths(fromEnv) : null) ?? findPmPaths(payload.cwd ?? io.cwd);
};

const handle = (event: HookEvent, payload: Payload, sync: boolean, io: CliIo): void => {
  const paths = locate(payload, io);
  if (!paths) return;
  if (event === "session-start") {
    // 告诉 AI 这个插件的 pm 命令在哪，Skill 里的步骤直接用它
    const entry = process.argv[1];
    io.out(contextText(paths, entry && entry.endsWith("pm.mjs") ? `node ${JSON.stringify(resolve(entry))}` : undefined));
    return;
  }
  if (event === "stop") {
    recordFromPayload(paths, payload).warnings.forEach((w) => io.err(`警告：${w}\n`));
    writeDashboard(paths, new Date());
    return;
  }
  if (!sync) {
    spawnSessionEnd(paths, payload, io);
    return;
  }
  try {
    sessionEndWork(paths, payload);
  } catch (error: unknown) {
    // 后台进程的 stderr 没人看：失败必须进日志
    appendLog(paths, "会话结束处理失败", [error instanceof Error ? error.message : String(error)]);
    throw error;
  }
};

export const hook: Command = (args, io) => {
  const { positionals, flags } = parseArgs(args, { flags: ["--sync"] });
  const event = positionals[0] as HookEvent | undefined;
  if (!event || !EVENTS.includes(event)) throw new UsageError(`pm hook 需要事件名：${EVENTS.join(" | ")}`);
  try {
    handle(event, parsePayload(io.readStdin?.() ?? ""), flags.has("--sync"), io);
  } catch (error: unknown) {
    io.err(`pm hook ${event}：${error instanceof Error ? error.message : String(error)}\n`);
  }
  return EXIT.ok;
};
