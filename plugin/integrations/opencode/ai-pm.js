// ai-pm 的 OpenCode 插件：由 `pm setup opencode` 生成，请勿手改（重新运行 setup 即可更新）。
// 把 OpenCode 的会话事件对接到 `pm hook`：
//   首次对话前 → session-start（项目摘要注入系统提示）
//   message.updated（助手消息完成）→ 把 token 用量写成通用格式
//   session.idle → stop（记 token、刷新项目地图）
//   session.deleted → session-end（后台跑验收）
// 在没有 .pm/ 的项目里，pm 什么都不做，插件也就什么都不做。
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PM = "__PM_MJS__";
const USAGE_DIR = join(tmpdir(), "ai-pm-opencode");
const HOOK_TIMEOUT_MS = 30_000;

const usageFile = (sessionID) => join(USAGE_DIR, `${String(sessionID).replace(/[^\w.-]/g, "_")}.jsonl`);

export const AiPm = async ({ directory }) => {
  mkdirSync(USAGE_DIR, { recursive: true });
  const contexts = new Map();

  /** 调用 pm hook；任何失败都只记一行日志，绝不影响 OpenCode 会话 */
  const hook = (event, sessionID) => {
    const payload = JSON.stringify({ session_id: sessionID, transcript_path: usageFile(sessionID), cwd: directory });
    const result = spawnSync("node", [PM, "hook", event], { input: payload, cwd: directory, encoding: "utf8", timeout: HOOK_TIMEOUT_MS });
    if (result.error) console.error(`[ai-pm] pm hook ${event} 失败：${result.error.message}`);
    return result.stdout || "";
  };

  return {
    event: async ({ event }) => {
      const props = event.properties || {};
      if (event.type === "message.updated") {
        const m = props.info;
        // 助手消息完成前会多次触发，只记完成后的那一次（同一 id 以最后一行为准）
        if (!m || m.role !== "assistant" || !m.time || !m.time.completed || !m.tokens) return;
        const line = {
          type: "pm-usage",
          id: m.id,
          input: m.tokens.input || 0,
          output: (m.tokens.output || 0) + (m.tokens.reasoning || 0),
          cacheRead: (m.tokens.cache && m.tokens.cache.read) || 0,
          cacheWrite: (m.tokens.cache && m.tokens.cache.write) || 0,
        };
        appendFileSync(usageFile(m.sessionID), `${JSON.stringify(line)}\n`);
      } else if (event.type === "session.idle" && props.sessionID) {
        hook("stop", props.sessionID);
        contexts.delete(props.sessionID); // 下次对话前重新计算摘要
      } else if (event.type === "session.deleted" && props.info && props.info.id) {
        hook("session-end", props.info.id);
        contexts.delete(props.info.id);
      }
    },
    // OpenCode 的实验性钩子：把项目摘要追加到系统提示
    "experimental.chat.system.transform": async (input, output) => {
      const sessionID = input && input.sessionID;
      if (!sessionID) return;
      if (!contexts.has(sessionID)) contexts.set(sessionID, hook("session-start", sessionID));
      const context = contexts.get(sessionID);
      if (context) output.system.push(context);
    },
  };
};
