// 只读地访问 git：提交列表、某个提交里的文件、工作区是否有改动。不经过 shell，参数原样传给 git
import { spawnSync } from "node:child_process";
import { relative, sep } from "node:path";
import type { CommitInfo } from "./timeline.js";

const MAX_OUTPUT = 64 * 1024 * 1024;
const FIELD = "\u001f";
const HASH = /^[0-9a-f]{7,64}$/;

const git = (cwd: string, args: readonly string[]): { ok: boolean; out: string } => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: MAX_OUTPUT });
  return { ok: !result.error && result.status === 0, out: result.stdout ?? "" };
};

/** 仓库根目录；不在 git 仓库里（或没装 git）时返回 null */
export const repoRoot = (dir: string): string | null => {
  const result = git(dir, ["rev-parse", "--show-toplevel"]);
  return result.ok ? result.out.trim() : null;
};

/** 相对仓库根目录的路径，统一成 / 分隔，供 git show <提交>:<路径> 使用 */
export const repoPath = (root: string, absolute: string): string => relative(root, absolute).split(sep).join("/");

/** 当前分支的提交，从新到旧；合并进来的分支只看主线（--first-parent） */
export const readCommits = (root: string, limit: number): CommitInfo[] => {
  const result = git(root, ["log", "--first-parent", `--max-count=${limit}`, `--format=%H${FIELD}%h${FIELD}%cI${FIELD}%s`]);
  if (!result.ok) return [];
  return result.out.split("\n").filter(Boolean).flatMap((line) => {
    const [hash = "", short = "", date = "", subject = ""] = line.split(FIELD);
    return HASH.test(hash) && HASH.test(short) ? [{ hash, short, date, subject }] : [];
  });
};

/** 某个提交里的文件内容；那时文件还不存在时返回 null */
export const readAtCommit = (root: string, hash: string, path: string): string | null => {
  if (!HASH.test(hash)) throw new Error(`不是合法的提交哈希：${hash}`);
  const result = git(root, ["show", `${hash}:${path}`]);
  return result.ok ? result.out : null;
};

/** 工作区里这个目录相对 HEAD 有没有改动（含未跟踪文件） */
export const isDirty = (root: string, path: string): boolean => {
  const result = git(root, ["status", "--porcelain", "--untracked-files=all", "--", path]);
  return result.ok && result.out.trim().length > 0;
};
