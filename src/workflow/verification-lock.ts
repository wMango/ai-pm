import { randomUUID } from "node:crypto";
import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";

/** 长验收任务使用 PID 锁；不按时间抢占仍在运行的任务，也不排队再跑一遍。 */
export const withVerificationLock = <T>(path: string, work: () => T): T => {
  const owner = JSON.stringify({ pid: process.pid, token: randomUUID() });
  let acquired = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fd = openSync(path, "wx", 0o600);
      try { writeFileSync(fd, owner); } finally { closeSync(fd); }
      acquired = true;
      break;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let previous: string;
      try { previous = readFileSync(path, "utf8"); } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      let pid: number | undefined;
      try { pid = (JSON.parse(previous) as { pid?: number }).pid; } catch { /* 创建者可能尚未写完 */ }
      let alive = true;
      if (Number.isInteger(pid) && (pid as number) > 0) {
        try { process.kill(pid as number, 0); } catch (error: unknown) {
          alive = (error as NodeJS.ErrnoException).code !== "ESRCH";
        }
      } else {
        try { alive = Date.now() - statSync(path).mtimeMs < 30_000; } catch { continue; }
      }
      if (alive) throw new Error("本项目已有验收任务运行，本次跳过重复启动");
      try {
        if (readFileSync(path, "utf8") === previous) unlinkSync(path);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  if (!acquired) throw new Error("无法取得验收任务锁，本次未运行");
  try { return work(); } finally {
    try { if (readFileSync(path, "utf8") === owner) unlinkSync(path); } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
};
