// pm statusline：Claude Code 状态栏命令。读 stdin 的状态栏 JSON，输出一行项目摘要；
// 状态栏每次刷新都会调用，任何问题都只让它保持空白，绝不在状态栏里报错
import type { Analysis } from "../analyze.js";
import { analyzeProject } from "./report.js";
import { EXIT, findPmPaths, readCurrentNode } from "./shared.js";
import type { Command } from "./shared.js";

const NAME_MAX = 16;
const PROJECT_MAX = 20;
const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f]", "g");

/** 压平空白、去掉控制字符，再按字数截短 */
const tidy = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, " ").replace(CONTROL, "").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** 状态栏输入里的项目目录；输入不是 JSON 或没有目录时用当前目录 */
const projectDirOf = (raw: string, fallback: string): string => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const { workspace, cwd } = parsed as { workspace?: { project_dir?: unknown; current_dir?: unknown }; cwd?: unknown };
    const candidate = [workspace?.project_dir, workspace?.current_dir, cwd].find((v): v is string => typeof v === "string" && v.length > 0);
    return candidate ?? fallback;
  } catch {
    return fallback;
  }
};

export const buildStatusLine = (analysis: Analysis, currentNode: string | null): string => {
  const name = (id: string): string => tidy(analysis.nodes.find((n) => n.id === id)?.name ?? id, NAME_MAX);
  const { total, effective } = analysis.metrics;
  const next = analysis.recommendations[0];
  const pending = analysis.nodes.filter((n) => n.pendingReview).length;
  const stuck = analysis.cost.stuck.length;
  return [
    `◆ ${tidy(analysis.project, PROJECT_MAX)}`,
    `生效 ${effective}/${total}`,
    currentNode && analysis.nodes.some((n) => n.id === currentNode) ? `当前 ${name(currentNode)}` : "当前 未声明",
    next ? `下一步 ${name(next.target)}` : "目标已达成",
    pending ? `待复核 ${pending}` : null,
    stuck ? `卡住 ${stuck}` : null,
  ].filter(Boolean).join(" · ");
};

export const statusline: Command = (_args, io) => {
  const paths = findPmPaths(projectDirOf(io.readStdin?.() ?? "", io.cwd));
  if (!paths) return EXIT.ok;
  try {
    const { analysis } = analyzeProject(paths, new Date());
    io.out(`${buildStatusLine(analysis, readCurrentNode(paths))}\n`);
  } catch {
    // pm.yaml 有错时状态栏保持空白；错误会在 pm dashboard / pm context 里给出
  }
  return EXIT.ok;
};
