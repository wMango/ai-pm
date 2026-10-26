import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { PmModel, PmNode } from "../schema.js";
import { runnerFor } from "./runner.js";

export const lockSchema = z.object({
  lockedAt: z.string(),
  /** human：人确认（功能层必须）；ai：AI 自签 */
  by: z.enum(["human", "ai"]),
  /** 路径 → sha256 */
  files: z.record(z.string(), z.string()),
  /** 验收测试路径 → 锁定时使用的运行命令；改了命令同样需要复核 */
  runners: z.record(z.string(), z.string().nullable()).default({}),
  /** terminal：由人在终端里亲手确认（功能层必须） */
  confirmedVia: z.enum(["terminal"]).optional(),
});
export const locksSchema = z.record(z.string(), lockSchema);
export type Lock = z.infer<typeof lockSchema>;
export type Locks = z.infer<typeof locksSchema>;

/** 一个节点需要锁定的文件：验收条目 + 验收测试（去重） */
export const lockedFilesOf = (node: Pick<PmNode, "spec" | "acceptance">): string[] => [...new Set([...(node.spec ? [node.spec] : []), ...node.acceptance])];

export const runnersOf = (node: Pick<PmNode, "acceptance">, runners: PmModel["settings"]["runners"]): Record<string, string | null> =>
  Object.fromEntries([...new Set(node.acceptance)].map((path) => [path, runnerFor(path, runners)?.command ?? null]));

export const fingerprint = (root: string, path: string): string | null => {
  const full = resolve(root, path);
  return existsSync(full) ? createHash("sha256").update(readFileSync(full)).digest("hex") : null;
};

export const parseLocks = (text: string | null): Locks => {
  if (text === null) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("locks.json 不是合法 JSON");
  }
  const parsed = locksSchema.safeParse(raw);
  if (!parsed.success) throw new Error("locks.json 格式错误");
  return parsed.data;
};

const sameKeys = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((k) => b.includes(k));

/** 人在终端里确认过的锁 */
export const isHumanConfirmed = (lock: Lock): boolean => lock.by === "human" && lock.confirmedVia === "terminal";

/**
 * 待复核：未锁定、文件集合变了、任何文件内容变了、运行命令变了，
 * 或者功能层节点的锁不是由人在终端里确认的（被伪造或旧方式锁定）
 */
export const isPendingReview = (
  root: string,
  node: Pick<PmNode, "spec" | "acceptance">,
  lock: Lock | undefined,
  runners: PmModel["settings"]["runners"],
  requireHuman = false,
): boolean => {
  if (!lock) return true;
  if (requireHuman && !isHumanConfirmed(lock)) return true;
  const files = lockedFilesOf(node);
  if (!sameKeys(files, Object.keys(lock.files))) return true;
  if (files.some((f) => fingerprint(root, f) !== lock.files[f])) return true;
  const current = runnersOf(node, runners);
  return Object.entries(current).some(([path, command]) => lock.runners[path] !== command);
};
