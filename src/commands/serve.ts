// pm serve [--port 8793] [--idle-minutes 10]：可选的本机实时地图服务（秒级推送）；无人访问时自动退出。
// 平时不需要它：直接打开 .pm/dashboard.html 也会自动更新
import { startLiveServer } from "../live/server.js";
import { CommandError, EXIT, UsageError, isManaged, parseArgs, pmPaths } from "./shared.js";
import type { Command } from "./shared.js";

const DEFAULT_PORT = 8793;
/** 默认 10 分钟没人看就退出，避免每个项目都留一个常驻进程 */
const DEFAULT_IDLE_MINUTES = 10;
const MAX_IDLE_MINUTES = 24 * 60;
const MS_PER_MINUTE = 60_000;
const MAX_PORT = 65535;

const parsePort = (raw: string | undefined): number => {
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) throw new UsageError(`--port 要是 1 到 ${MAX_PORT} 之间的整数：${raw}`);
  return port;
};

const parseIdle = (raw: string | undefined): number => {
  if (raw === undefined) return DEFAULT_IDLE_MINUTES;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > MAX_IDLE_MINUTES) throw new UsageError(`--idle-minutes 要是 0 到 ${MAX_IDLE_MINUTES} 之间的数（0 表示一直运行）：${raw}`);
  return minutes;
};

export const serve: Command = (args, io) => {
  const { options } = parseArgs(args, { options: ["--dir", "--port", "--idle-minutes"] });
  const idleMinutes = parseIdle(options["--idle-minutes"]);
  const paths = pmPaths(io.cwd, options["--dir"]);
  if (!isManaged(paths)) throw new CommandError(`找不到 ${paths.file("pm.yaml")}（先运行 pm init）`);
  // 服务是长期运行的：命令本身立即返回，进程由服务保持；启动失败时再设置退出码
  const onIdle = (): void => io.out(`已经 ${idleMinutes} 分钟没有人打开实时地图，服务已自动退出\n`);
  startLiveServer(paths, { port: parsePort(options["--port"]), idleMs: idleMinutes * MS_PER_MINUTE, onIdle })
    .then(({ url }) => io.out(`实时地图：${url}\n只在本机可访问、只读；项目一变页面自动更新。${idleMinutes ? `${idleMinutes} 分钟没人打开会自动退出，` : ""}按 Ctrl-C 结束\n`))
    .catch((error: unknown) => {
      io.err(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = EXIT.failed;
    });
  return EXIT.ok;
};
