import type { TokenBreakdown } from "../schema.js";

export const EMPTY_BREAKDOWN: TokenBreakdown = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

/**
 * 从 Claude Code 的会话记录（JSONL）里汇总 token 用量。
 * 记录格式是 Claude Code 的内部格式，可能随版本变化：解析不了的行一律跳过。
 * 同一条 assistant 消息会被拆成多行并重复携带 usage，按 message.id 去重（取最后一行）。
 */
export const parseTranscriptUsage = (text: string): TokenBreakdown => {
  const byMessage = new Map<string, TokenBreakdown>();
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof entry !== "object" || entry === null || (entry as { type?: unknown }).type !== "assistant") return;
    const message = (entry as { message?: { id?: unknown; usage?: Record<string, unknown> } }).message;
    const usage = message?.usage;
    if (!usage) return;
    const key = typeof message.id === "string" ? message.id : `line-${i}`;
    byMessage.set(key, {
      input: num(usage.input_tokens),
      output: num(usage.output_tokens),
      cacheWrite: num(usage.cache_creation_input_tokens),
      cacheRead: num(usage.cache_read_input_tokens),
    });
  });
  return [...byMessage.values()].reduce((acc, u) => addBreakdown(acc, u), EMPTY_BREAKDOWN);
};

export const addBreakdown = (a: TokenBreakdown, b: TokenBreakdown): TokenBreakdown => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  cacheRead: a.cacheRead + b.cacheRead,
});

/** 增量：current 相对 recorded 的新增部分，不会为负 */
export const subtractBreakdown = (current: TokenBreakdown, recorded: TokenBreakdown): TokenBreakdown => ({
  input: Math.max(0, current.input - recorded.input),
  output: Math.max(0, current.output - recorded.output),
  cacheWrite: Math.max(0, current.cacheWrite - recorded.cacheWrite),
  cacheRead: Math.max(0, current.cacheRead - recorded.cacheRead),
});

/** processed：新处理的 token（输入 + 输出 + 缓存写入）；all：再加上缓存读取 */
export const tokensOf = (b: TokenBreakdown, mode: "processed" | "all"): number =>
  b.input + b.output + b.cacheWrite + (mode === "all" ? b.cacheRead : 0);
