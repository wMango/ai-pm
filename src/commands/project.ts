// pm init / pm start / pm lock：项目初始化、声明当前模块、锁定验收条目
import { existsSync, mkdirSync } from "node:fs";
import { basename, relative } from "node:path";
import { lockedFilesOf, fingerprint, parseLocks, runnersOf } from "../workflow/locks.js";
import type { Lock } from "../workflow/locks.js";
import { CommandError, EXIT, UsageError, ensureGitignore, findNode, loadModel, parseArgs, pmPaths, readOptional, trustRunners, writeFileEnsured, writeJson } from "./shared.js";
import type { Command } from "./shared.js";

const pmTemplate = (project: string): string => `# 由 pm init 生成（ai-pm 插件）
# 三套架构各自独立；状态只由验收测试决定；每个视图不超过 40 个节点
version: 1
project: ${JSON.stringify(project)}
settings:
  runners:                      # 按文件后缀选择运行命令，{file} 会被替换成加了引号的路径
    ".sh": "bash {file}"
    # ".test.ts": "npx vitest run {file}"
    # ".spec.ts": "npx playwright test {file}"
views:
  functional: []                # 用户可感知的能力；spec 指向 .pm/acceptance/<id>.feature
  logical: []                   # 需要 layer: front | service | data | external
  physical: []
mappings: []                    # realized_by：功能 → 逻辑；deployed_on：逻辑 → 物理
goals: []                       # requires 写目标需要的节点；journey 写用户旅程
`;

export const init: Command = (args, io) => {
  const { options } = parseArgs(args, { options: ["--dir", "--project"] });
  const paths = pmPaths(io.cwd, options["--dir"]);
  if (existsSync(paths.file("pm.yaml"))) throw new CommandError(`${relative(io.cwd, paths.file("pm.yaml"))} 已经存在，不会覆盖`);
  const project = options["--project"] ?? basename(paths.root);
  writeFileEnsured(paths.file("pm.yaml"), pmTemplate(project));
  mkdirSync(paths.file("acceptance"), { recursive: true });
  writeFileEnsured(paths.file("ledger.jsonl"), "");
  ensureGitignore(paths);
  // 自己刚建的 runners 默认信任；之后别人改了 runners，钩子不会自动执行
  trustRunners(paths, loadModel(paths).model);
  io.out(`已初始化 ${relative(io.cwd, paths.pmDir) || "."}/：pm.yaml、acceptance/、ledger.jsonl\n下一步：和人确认目标，再起草三套架构\n`);
  return EXIT.ok;
};

export const start: Command = (args, io) => {
  const { positionals, options } = parseArgs(args, { options: ["--dir"] });
  const id = positionals[0];
  if (!id) throw new UsageError("pm start 需要一个节点 id");
  const paths = pmPaths(io.cwd, options["--dir"]);
  const { model } = loadModel(paths);
  const { view, node } = findNode(model, id);
  writeJson(paths.file("current.json"), { node: id, at: new Date().toISOString() });
  const lines = [`开工：${node.name}（${id}，${view}）`];
  if (!node.spec) lines.push(`还没有验收条目：请起草 .pm/acceptance/${id}.feature（1–5 个场景），写入 spec 字段`);
  if (view === "functional") lines.push("这是功能层节点：验收条目必须给人逐条确认；写好会失败的测试后，请用户在自己的终端里运行 pm lock，按 y 确认锁定（AI 不能代劳）");
  if (node.acceptance.length === 0) lines.push("还没有可执行的验收测试：根据验收条目生成测试，先运行 pm verify --only <id> 确认它失败");
  io.out(`${lines.join("\n")}\n`);
  return EXIT.ok;
};

const SPEC_PREVIEW_LINES = 60;
const CONFIRM_ANSWER = /^(y|yes)$/i;

/** 给人的 pm 命令写法：插件里是 node ".../pm.mjs"，开发时是 pm */
const pmCommandText = (): string => {
  const entry = process.argv[1];
  return entry && entry.endsWith("pm.mjs") ? `node ${JSON.stringify(entry)}` : "pm";
};

/** 终端里展示给人的确认内容：验收条目原文 + 测试文件 */
const confirmationText = (root: string, id: string, node: { name: string; spec?: string; acceptance: string[] }): string => {
  const spec = node.spec ? readOptional(`${root}/${node.spec}`) : null;
  const specLines = spec ? spec.split("\n") : [];
  const preview = specLines.slice(0, SPEC_PREVIEW_LINES).map((l) => `  │ ${l}`).join("\n");
  const more = specLines.length > SPEC_PREVIEW_LINES ? `\n  │ …（还有 ${specLines.length - SPEC_PREVIEW_LINES} 行，见 ${node.spec}）` : "";
  return [
    "",
    `── 确认验收条目：${node.name}（${id}）──`,
    node.spec ? `验收条目 ${node.spec}：\n${preview}${more}` : "（没有验收条目）",
    `验收测试：${node.acceptance.length ? node.acceptance.join("、") : "（还没有）"}`,
    `确认以上内容就是"${node.name}"完成的标准，并锁定？输入 y 确认，其他任何输入都会取消：`,
  ].join("\n");
};

interface PlannedLock {
  id: string;
  node: { name: string; spec?: string; acceptance: string[] };
  needsHuman: boolean;
  files: Record<string, string>;
  runners: Lock["runners"];
}

export const lock: Command = (args, io) => {
  const { positionals, options } = parseArgs(args, { options: ["--dir", "--by"] });
  if (!positionals.length) throw new UsageError("pm lock 需要至少一个节点 id");
  const by = options["--by"] ?? "ai";
  if (by !== "human" && by !== "ai") throw new UsageError("--by 只能是 human 或 ai");
  const paths = pmPaths(io.cwd, options["--dir"]);
  const { model } = loadModel(paths);
  // 先检查全部节点的文件，再向人提问：要么全部锁定，要么一个都不锁
  const planned = positionals.map((id): PlannedLock => {
    const { view, node } = findNode(model, id);
    const files = lockedFilesOf(node);
    if (!files.length) throw new CommandError(`${id} 还没有验收条目或验收测试，无法锁定`);
    const hashes = files.map((f) => [f, fingerprint(paths.root, f)] as const);
    const missing = hashes.filter(([, h]) => h === null).map(([f]) => f);
    if (missing.length) throw new CommandError(`无法锁定 ${id}：${missing.join("、")} 不存在`);
    return { id, node, needsHuman: view === "functional" || by === "human", files: Object.fromEntries(hashes) as Record<string, string>, runners: runnersOf(node, model.settings.runners) };
  });
  const human = planned.filter((p) => p.needsHuman);
  if (human.length && !io.isInteractive?.()) {
    const ids = human.map((p) => p.id).join(" ");
    throw new CommandError(
      `${ids} 需要人确认（功能层节点，或指定了 --by human）：必须由人在终端里亲手确认，AI 不能代劳。\n请把下面这条命令交给用户，在自己的终端里运行：\n  cd ${JSON.stringify(paths.root)} && ${pmCommandText()} lock ${ids}`,
    );
  }
  for (const p of human) {
    const answer = io.prompt?.(confirmationText(paths.root, p.id, p.node)) ?? null;
    if (answer === null || !CONFIRM_ANSWER.test(answer.trim())) throw new CommandError(`已取消：${p.id} 未锁定`);
  }
  const now = new Date().toISOString();
  const updates = planned.map((p): [string, Lock] => [
    p.id,
    { lockedAt: now, by: p.needsHuman ? "human" : "ai", files: p.files, runners: p.runners, ...(p.needsHuman ? { confirmedVia: "terminal" as const } : {}) },
  ]);
  const locks = { ...parseLocks(readOptional(paths.file("locks.json"))), ...Object.fromEntries(updates) };
  writeJson(paths.file("locks.json"), locks);
  io.out(`已锁定：${updates.map(([id, l]) => `${id}（${Object.keys(l.files).length} 个文件，${l.by === "human" ? "人在终端确认" : "AI 自签"}）`).join("、")}\n`);
  return EXIT.ok;
};

/** pm trust：确认当前 settings.runners 可以在会话结束时自动运行 */
export const trust: Command = (args, io) => {
  const { options } = parseArgs(args, { options: ["--dir"] });
  const paths = pmPaths(io.cwd, options["--dir"]);
  const { model } = loadModel(paths);
  trustRunners(paths, model);
  const lines = Object.entries(model.settings.runners).map(([suffix, cmd]) => `  ${suffix}  →  ${cmd}`);
  io.out(`已信任以下验收运行命令（超时 ${model.settings.testTimeoutSec} 秒），会话结束时会自动运行：\n${lines.join("\n")}\n`);
  return EXIT.ok;
};
