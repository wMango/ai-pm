import { closeSync, openSync, readFileSync, readSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { EXIT, UsageError } from "./commands/shared.js";
import type { CliIo, Command } from "./commands/shared.js";
import { init, lock, start, trust } from "./commands/project.js";
import { verify } from "./commands/verify.js";
import { record } from "./commands/record.js";
import { context, dashboard } from "./commands/report.js";
import { hook } from "./commands/hook.js";

export type { CliIo } from "./commands/shared.js";

const COMMANDS: Record<string, Command> = { init, start, lock, trust, verify, record, dashboard, context, hook };

const USAGE = `用法：pm <命令> [参数]
  init      [--project 名称]                 初始化 .pm/
  start     <节点 id>                         声明当前在做的模块
  lock      <节点 id...> [--by human|ai]      锁定验收条目与测试（功能层必须由人在终端里按 y 确认）
  trust                                       信任当前 runners，允许会话结束时自动跑验收
  verify    [--only id,id]                    运行验收测试，写出 evidence.json
  record    --session <id> --transcript <文件>  把会话 token 增量记到当前模块
  dashboard [--out 文件] [--now ISO 时间]      生成 .pm/dashboard.html
  context                                     输出给 AI 的项目摘要
  hook      <session-start|stop|session-end>  Claude Code 钩子入口（读 stdin）
所有命令都支持 --dir 指定 .pm 目录（默认 .pm）
`;

/** 去掉终端控制字符（保留换行与制表符），防止 pm.yaml 片段里的转义序列操纵终端 */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f]", "g");
const stripControl = (text: string): string => text.replace(CONTROL_CHARS, "");

/** 命令行入口；返回退出码，便于测试 */
export const runCli = (argv: readonly string[], rawIo: CliIo): number => {
  const io: CliIo = { ...rawIo, out: (t) => rawIo.out(stripControl(t)), err: (t) => rawIo.err(stripControl(t)) };
  const [name, ...rest] = argv;
  const command = name ? COMMANDS[name] : undefined;
  if (!command) {
    io.err(name ? `未知命令：${name}\n${USAGE}` : USAGE);
    return EXIT.usage;
  }
  try {
    return command(rest, io);
  } catch (error: unknown) {
    if (error instanceof UsageError) {
      io.err(`${error.message}\n${USAGE}`);
      return EXIT.usage;
    }
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT.failed;
  }
};

/** 插件目录可能是软链：两边都取真实路径再比较 */
const isMainModule = (): boolean => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(new URL(import.meta.url)) === realpathSync(entry);
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
};
const isMain = isMainModule();

const NEWLINE = 0x0a;
/**
 * 从终端同步读一行。另开 /dev/tty：Node 会把 process.stdin 的 fd 0 设为非阻塞，
 * 直接同步读会立刻得到 EAGAIN。逐字节读，最后统一按 UTF-8 解码。
 */
const readLineFromTerminal = (): string | null => {
  let fd: number | null = null;
  try {
    fd = openSync("/dev/tty", "r");
    const bytes: number[] = [];
    const buf = Buffer.alloc(1);
    while (readSync(fd, buf, 0, 1, null) === 1) {
      if (buf[0] === NEWLINE) return Buffer.from(bytes).toString("utf8").replace(/\r$/, "");
      bytes.push(buf[0] as number);
    }
    return bytes.length ? Buffer.from(bytes).toString("utf8") : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
};
if (isMain) {
  process.exitCode = runCli(process.argv.slice(2), {
    cwd: process.cwd(),
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
    readStdin: () => (process.stdin.isTTY ? "" : readFileSync(0, "utf8")),
    // 标准输入和输出都连着终端，才算"人在终端前"；AI 通过工具运行命令、或用管道喂输入时都不成立
    isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
    prompt: (question) => {
      process.stdout.write(`${question} `);
      return readLineFromTerminal();
    },
  });
}
