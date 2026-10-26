import type { TokenBreakdown } from "../schema.js";

export const EMPTY_BREAKDOWN: TokenBreakdown = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

type Row = Record<string, unknown>;
const asRow = (value: unknown): Row | null => (typeof value === "object" && value !== null ? (value as Row) : null);

/** Claude Code：assistant 消息的 message.usage，同一消息多行重复，按 id 去重 */
const claudeUsage = (entry: Row): { id: unknown; usage: TokenBreakdown } | null => {
  if (entry.type !== "assistant") return null;
  const message = asRow(entry.message);
  const usage = asRow(message?.usage);
  if (!usage) return null;
  return {
    id: message?.id,
    usage: {
      input: num(usage.input_tokens),
      output: num(usage.output_tokens),
      cacheWrite: num(usage.cache_creation_input_tokens),
      cacheRead: num(usage.cache_read_input_tokens),
    },
  };
};

/**
 * Codex：event_msg / token_count 里的 total_token_usage 是会话累计值，取最后一条。
 * input_tokens 已包含缓存命中部分，output_tokens 已包含推理 token。
 */
const codexTotal = (entry: Row): TokenBreakdown | null => {
  const payload = asRow(entry.payload);
  if (entry.type !== "event_msg" || payload?.type !== "token_count") return null;
  const total = asRow(asRow(payload.info)?.total_token_usage);
  if (!total) return null;
  const cached = num(total.cached_input_tokens);
  return {
    input: Math.max(0, num(total.input_tokens) - cached),
    output: num(total.output_tokens),
    cacheWrite: num(total.cache_write_input_tokens),
    cacheRead: cached,
  };
};

/** 通用格式（OpenCode 插件写入）：{"type":"pm-usage","id","input","output","cacheRead","cacheWrite"} */
const neutralUsage = (entry: Row): { id: unknown; usage: TokenBreakdown } | null => {
  if (entry.type !== "pm-usage") return null;
  return { id: entry.id, usage: { input: num(entry.input), output: num(entry.output), cacheWrite: num(entry.cacheWrite), cacheRead: num(entry.cacheRead) } };
};

/**
 * 从会话记录（JSONL）里汇总 token 用量，支持 Claude Code、Codex 与通用格式。
 * 这些都是各平台的内部格式，可能随版本变化：解析不了的行一律跳过。
 */
export const parseTranscriptUsage = (text: string): TokenBreakdown => {
  const byMessage = new Map<string, TokenBreakdown>();
  let codex: TokenBreakdown | null = null;
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    let entry: Row | null;
    try {
      entry = asRow(JSON.parse(line));
    } catch {
      return;
    }
    if (!entry) return;
    const perMessage = claudeUsage(entry) ?? neutralUsage(entry);
    if (perMessage) {
      byMessage.set(typeof perMessage.id === "string" ? perMessage.id : `line-${i}`, perMessage.usage);
      return;
    }
    codex = codexTotal(entry) ?? codex;
  });
  const summed = [...byMessage.values()].reduce((acc, u) => addBreakdown(acc, u), EMPTY_BREAKDOWN);
  return codex ? addBreakdown(summed, codex) : summed;
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
