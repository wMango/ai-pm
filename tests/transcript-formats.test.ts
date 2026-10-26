import { describe, expect, test } from "vitest";
import { parseTranscriptUsage } from "../src/index.js";

// 各平台会话记录的 token 格式（Codex 结构取自本机 codex-cli 0.132.0 的真实 rollout 文件）
const codexTokenCount = (total: Record<string, number> | null): string =>
  JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: total ? { total_token_usage: total, last_token_usage: total } : null } });

describe("Codex rollout", () => {
  test("uses the last cumulative total, not the sum of events", () => {
    const text = [
      JSON.stringify({ type: "session_meta", payload: { id: "x" } }),
      codexTokenCount({ input_tokens: 1000, cached_input_tokens: 600, cache_write_input_tokens: 0, output_tokens: 50, reasoning_output_tokens: 20, total_tokens: 1050 }),
      codexTokenCount(null),
      codexTokenCount({ input_tokens: 3000, cached_input_tokens: 2000, cache_write_input_tokens: 10, output_tokens: 120, reasoning_output_tokens: 40, total_tokens: 3120 }),
    ].join("\n");
    // input 已包含缓存命中部分，output 已包含推理 token
    expect(parseTranscriptUsage(text)).toEqual({ input: 1000, output: 120, cacheWrite: 10, cacheRead: 2000 });
  });

  test("a rollout without token counts yields zero", () => {
    expect(parseTranscriptUsage(codexTokenCount(null))).toEqual({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
  });
});

describe("neutral pm-usage lines (written by the OpenCode plugin)", () => {
  test("dedupes by message id, last line wins", () => {
    const line = (id: string, output: number): string => JSON.stringify({ type: "pm-usage", id, input: 5, output, cacheRead: 100, cacheWrite: 7 });
    const text = [line("m1", 3), line("m1", 9), line("m2", 4)].join("\n");
    expect(parseTranscriptUsage(text)).toEqual({ input: 10, output: 13, cacheWrite: 14, cacheRead: 200 });
  });

  test("ignores malformed pm-usage values", () => {
    const text = JSON.stringify({ type: "pm-usage", id: "m1", input: "lots", output: -5 });
    expect(parseTranscriptUsage(text)).toEqual({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
  });
});
