#!/usr/bin/env bash
# p-marketplace 验收：本地插件市场能指向完整的 ai-pm 插件（对应 .pm/acceptance/p-marketplace.feature）
set -euo pipefail
root="${PM_ROOT:-$PWD}"

node - "$root" <<'JS' || exit 1
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const root = process.argv[2];
const fail = (msg) => { console.error(msg); process.exit(1); };
const readJson = (path) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch (e) { fail(`${path} 不是合法 JSON：${e.message}`); } };

const market = readJson(join(root, ".claude-plugin/marketplace.json"));
const entry = (market.plugins ?? []).find((p) => p.name === "ai-pm") ?? fail("marketplace.json 里没有 ai-pm");
const pluginDir = join(root, entry.source);
const manifest = readJson(join(pluginDir, ".claude-plugin/plugin.json"));
if (manifest.name !== "ai-pm") fail(`plugin.json 的 name 是 ${manifest.name}，应为 ai-pm`);
const hooks = readJson(join(pluginDir, "hooks/hooks.json")).hooks ?? {};
for (const event of ["SessionStart", "Stop", "SessionEnd"]) {
  const commands = (hooks[event] ?? []).flatMap((g) => g.hooks ?? []).map((h) => h.command ?? "");
  if (!commands.some((c) => c.includes("bin/pm.mjs") && c.includes("hook"))) fail(`hooks.json 缺少 ${event} 钩子`);
}
for (const file of ["bin/pm.mjs", "skills/pm/SKILL.md"]) {
  if (!existsSync(join(pluginDir, file))) fail(`插件目录缺少 ${file}`);
}
JS
