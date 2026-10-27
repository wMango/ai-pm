// pm open [history] [--print]：一步打开项目地图（或提交历史）。打开前先重新生成，看到的总是最新状态
import { relative } from "node:path";
import { HISTORY_DIR, writeHistory } from "./history.js";
import { writeDashboard } from "./report.js";
import { CommandError, EXIT, UsageError, isManaged, parseArgs, pmPaths } from "./shared.js";
import type { CliIo, Command, PmPaths } from "./shared.js";
import { INDEX_PAGE } from "../history/render.js";

const TARGETS = ["map", "history"] as const;
type Target = (typeof TARGETS)[number];

const prepare = (paths: PmPaths, target: Target, now: Date): string => {
  if (target === "history") {
    writeHistory(paths, now);
    return paths.file(`${HISTORY_DIR}/${INDEX_PAGE}`);
  }
  writeDashboard(paths, now);
  return paths.file("dashboard.html");
};

const show = (io: CliIo, path: string): string => (path.startsWith(io.cwd) ? relative(io.cwd, path) : path);

export const open: Command = (args, io) => {
  const { positionals, options, flags } = parseArgs(args, { options: ["--dir"], flags: ["--print"] });
  const target = (positionals[0] ?? "map") as Target;
  if (!TARGETS.includes(target) || positionals.length > 1) throw new UsageError(`pm open 只能打开 ${TARGETS.join(" 或 ")}：${positionals.join(" ")}`);
  const paths = pmPaths(io.cwd, options["--dir"]);
  if (!isManaged(paths)) throw new CommandError(`找不到 ${paths.file("pm.yaml")}（先运行 pm init）`);
  const path = prepare(paths, target, new Date());
  if (flags.has("--print")) {
    io.out(`${path}\n`);
    return EXIT.ok;
  }
  if (!io.openPath) {
    io.out(`请在浏览器里打开：${path}\n`);
    return EXIT.ok;
  }
  const result = io.openPath(path);
  if (!result.ok) {
    io.err(`没能自动打开（${result.error ?? "未知原因"}），请在浏览器里手动打开：\n  ${path}\n`);
    return EXIT.failed;
  }
  io.out(`已打开 ${show(io, path)}${target === "map" ? "（页面会随项目自动更新）" : ""}\n`);
  return EXIT.ok;
};
