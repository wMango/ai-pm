// pm history：按提交回看项目演进。数据全部从 git 历史里的 .pm/ 重算，不另外存储
import { existsSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { analyze } from "../analyze.js";
import { loadPmYaml, parseEvidence, parseLedger } from "../load.js";
import { isDirty, readAtCommit, readCommits, repoPath, repoRoot } from "../history/git.js";
import { INDEX_PAGE, renderHistoryIndex, renderSnapshotPage } from "../history/render.js";
import { buildTimeline } from "../history/timeline.js";
import type { CommitInfo, HistoryEntry, Snapshot } from "../history/timeline.js";
import { analyzeProject } from "./report.js";
import { CommandError, EXIT, UsageError, ensureGitignore, isManaged, parseArgs, pmPaths, readLedger, writeFileEnsured } from "./shared.js";
import type { Command, PmPaths } from "./shared.js";

export const HISTORY_DIR = "history";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** 某个提交里的 .pm 状态；当时的 evidence / ledger 缺失就当作空 */
const snapshotAt = (root: string, pmDir: string, commit: CommitInfo): Snapshot => {
  const read = (name: string): string | null => readAtCommit(root, commit.hash, `${pmDir}/${name}`);
  const yaml = read("pm.yaml");
  if (yaml === null) return { commit, analysis: null, problem: "untracked" };
  const loaded = loadPmYaml(yaml);
  if (!loaded.ok) return { commit, analysis: null, problem: "invalid", note: loaded.errors.join("；") };
  try {
    const evidenceText = read("evidence.json");
    const evidence = evidenceText ? parseEvidence(JSON.parse(evidenceText)) : {};
    const ledger = parseLedger(read("ledger.jsonl") ?? "");
    return { commit, analysis: analyze(loaded.model, { evidence, ledger, now: new Date(commit.date) }), problem: null };
  } catch (error: unknown) {
    return { commit, analysis: null, problem: "invalid", note: errorText(error) };
  }
};

export interface HistoryResult {
  entries: HistoryEntry[];
  outDir: string;
}

/** 生成 .pm/history/：目录页 + 每个提交一页；旧页面先清掉，避免留下已不在历史里的提交 */
export const writeHistory = (paths: PmPaths, now: Date, limit = DEFAULT_LIMIT): HistoryResult => {
  const root = repoRoot(paths.root);
  if (!root) throw new CommandError("pm history 需要 git：这个项目不是 git 仓库（或没有安装 git）");
  // git 返回的是真实路径（macOS 上 /var 是 /private/var 的软链），两边都取真实路径再求相对路径
  const pmDir = repoPath(root, join(realpathSync(paths.root), basename(paths.pmDir)));
  const commits = readCommits(root, limit).map((c) => snapshotAt(root, pmDir, c));
  const current = isManaged(paths) && isDirty(root, pmDir) ? [{ commit: null, analysis: analyzeProject(paths, now).analysis, problem: null } satisfies Snapshot] : [];
  const snapshots = [...current, ...commits];
  const entries = buildTimeline(snapshots, readLedger(paths).entries);
  const outDir = paths.file(HISTORY_DIR);
  if (existsSync(outDir)) readdirSync(outDir).filter((f) => f.endsWith(".html")).forEach((f) => rmSync(`${outDir}/${f}`));
  entries.forEach((entry, i) => {
    const analysis = snapshots[i]?.analysis;
    if (entry.page && analysis) writeFileEnsured(`${outDir}/${entry.page}`, renderSnapshotPage(entry, analysis));
  });
  const project = snapshots.find((s) => s.analysis)?.analysis?.project ?? "项目";
  writeFileEnsured(`${outDir}/${INDEX_PAGE}`, renderHistoryIndex({ project, generatedAt: now.toISOString(), entries }));
  ensureGitignore(paths);
  return { entries, outDir };
};

/** 当前地图是否该显示"历史"入口 */
export const historyLink = (paths: PmPaths): string | undefined =>
  existsSync(paths.file(`${HISTORY_DIR}/${INDEX_PAGE}`)) ? `${HISTORY_DIR}/${INDEX_PAGE}` : undefined;

const parseLimit = (raw: string | undefined): number => {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) throw new UsageError(`--limit 要是 1 到 ${MAX_LIMIT} 之间的整数：${raw}`);
  return n;
};

export const history: Command = (args, io) => {
  const { options } = parseArgs(args, { options: ["--dir", "--limit"] });
  const paths = pmPaths(io.cwd, options["--dir"]);
  const { entries, outDir } = writeHistory(paths, new Date(), parseLimit(options["--limit"]));
  const commits = entries.filter((e) => e.commit).length;
  const tracked = entries.filter((e) => e.commit && e.state === "ok").length;
  io.out(`已生成 ${relative(io.cwd, `${outDir}/${INDEX_PAGE}`)}\n${commits} 个提交，其中 ${tracked} 个有项目地图${entries.some((e) => !e.commit) ? "，另含未提交的工作区" : ""}\n`);
  return EXIT.ok;
};
