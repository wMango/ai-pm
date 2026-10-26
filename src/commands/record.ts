// pm record：把一次会话的 token 增量记到当前模块（.pm/ledger.jsonl）
import { appendFileSync } from "node:fs";
import { UNASSIGNED_NODE } from "../schema.js";
import type { LedgerEntry, PmModel, TokenBreakdown } from "../schema.js";
import { addBreakdown, EMPTY_BREAKDOWN, parseTranscriptUsage, subtractBreakdown, tokensOf } from "../workflow/transcript.js";
import { EXIT, UsageError, loadModel, parseArgs, pmPaths, readCurrentNode, readLedger, readOptional, withPmLock } from "./shared.js";
import type { Command, PmPaths } from "./shared.js";

export interface RecordResult {
  entry: LedgerEntry | null;
  warnings: string[];
}

const isZero = (b: TokenBreakdown): boolean => b.input + b.output + b.cacheWrite + b.cacheRead === 0;

/**
 * 增量记录：会话累计用量 − 该会话已记录的用量 = 本次新增，记到当前声明的模块。
 * 同一会话里切换模块时，之后的增量自然记到新模块。
 */
export const recordSession = (paths: PmPaths, model: PmModel, session: string, transcriptPath: string, now: Date): RecordResult => {
  const text = readOptional(transcriptPath);
  if (text === null) return { entry: null, warnings: [`读不到会话记录 ${transcriptPath}，本次 token 未记录`] };
  const total = parseTranscriptUsage(text);
  // 读 ledger → 算增量 → 追加，整段加锁，避免 Stop 与后台进程同时记账造成重复
  return withPmLock(paths, () => appendDelta(paths, model, session, total, now));
};

const appendDelta = (paths: PmPaths, model: PmModel, session: string, total: TokenBreakdown, now: Date): RecordResult => {
  const recorded = readLedger(paths).entries
    .filter((e) => e.session === session && e.breakdown)
    .reduce((acc, e) => addBreakdown(acc, e.breakdown as TokenBreakdown), EMPTY_BREAKDOWN);
  const delta = subtractBreakdown(total, recorded);
  if (isZero(delta)) return { entry: null, warnings: [] };
  const current = readCurrentNode(paths);
  const known = current !== null && [...model.views.functional, ...model.views.logical, ...model.views.physical].some((n) => n.id === current);
  const warnings = known ? [] : [`未声明当前模块（先运行 pm start <id>），本次 token 记为 ${UNASSIGNED_NODE}`];
  const entry: LedgerEntry = {
    node: known ? (current as string) : UNASSIGNED_NODE,
    at: now.toISOString(),
    tokens: tokensOf(delta, model.settings.tokenCount),
    session,
    breakdown: delta,
  };
  appendFileSync(paths.file("ledger.jsonl"), `${JSON.stringify(entry)}\n`);
  return { entry, warnings };
};

export const record: Command = (args, io) => {
  const { options } = parseArgs(args, { options: ["--dir", "--session", "--transcript"] });
  const session = options["--session"];
  const transcript = options["--transcript"];
  if (!session || !transcript) throw new UsageError("pm record 需要 --session 和 --transcript");
  const paths = pmPaths(io.cwd, options["--dir"]);
  const { model } = loadModel(paths);
  const result = recordSession(paths, model, session, transcript, new Date());
  result.warnings.forEach((w) => io.err(`警告：${w}\n`));
  io.out(result.entry ? `已记录 ${result.entry.tokens} token → ${result.entry.node}\n` : "没有新增 token\n");
  return EXIT.ok;
};
