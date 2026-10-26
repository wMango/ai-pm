import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/cli.js";

export interface Run {
  code: number;
  out: string;
  err: string;
}

export interface Project {
  root: string;
  write: (path: string, content: string) => void;
  read: (path: string) => string;
  /** answers 不为空时模拟"人在终端里"，依次作为每个提问的回答 */
  run: (argv: string[], stdin?: string, answers?: string[]) => Run;
  prompts: string[];
  cleanup: () => void;
}

/** 在临时目录里搭一个项目，files 的键是相对项目根目录的路径 */
export const makeProject = (files: Record<string, string> = {}): Project => {
  const root = mkdtempSync(join(tmpdir(), "pm-cmd-"));
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  Object.entries(files).forEach(([path, content]) => write(path, content));
  const prompts: string[] = [];
  return {
    root,
    write,
    read: (path) => readFileSync(join(root, path), "utf8"),
    prompts,
    run: (argv, stdin = "", answers) => {
      const out: string[] = [];
      const err: string[] = [];
      const queue = [...(answers ?? [])];
      const code = runCli(argv, {
        cwd: root,
        out: (s) => out.push(s),
        err: (s) => err.push(s),
        readStdin: () => stdin,
        isInteractive: () => answers !== undefined,
        prompt: (question) => {
          prompts.push(question);
          return queue.shift() ?? null;
        },
      });
      return { code, out: out.join(""), err: err.join("") };
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** 一个小项目：功能 f 由逻辑 a 实现，a 依赖 b */
export const SMALL_PM = `version: 1
project: 小项目
settings:
  runners: { ".sh": "sh {file}" }
  testTimeoutSec: 2
views:
  functional:
    - { id: f, name: 功能 F, spec: .pm/acceptance/f.feature, acceptance: [t/f.sh] }
  logical:
    - { id: a, name: 组件 A, layer: service, acceptance: [t/pass.sh], depends: [{ on: b }] }
    - { id: b, name: 组件 B, layer: data, acceptance: [t/pass.sh, t/fail.sh] }
mappings:
  - { from: f, to: a, kind: realized_by }
goals:
  - { id: G1, name: 目标一, requires: [f] }
`;

export const PASS = "exit 0\n";
export const FAIL = "exit 1\n";

export const smallProject = (): Project =>
  makeProject({
    ".pm/pm.yaml": SMALL_PM,
    ".pm/acceptance/f.feature": "Feature: F\n  Scenario: works\n    Given x\n    Then y\n",
    "t/f.sh": FAIL,
    "t/pass.sh": PASS,
    "t/fail.sh": FAIL,
  });

/** 构造 Claude Code transcript 的一行 assistant 消息 */
export const assistantLine = (id: string, usage: { input?: number; output?: number; cacheWrite?: number; cacheRead?: number }): string =>
  JSON.stringify({
    type: "assistant",
    sessionId: "s1",
    message: {
      id,
      usage: {
        input_tokens: usage.input ?? 0,
        output_tokens: usage.output ?? 0,
        cache_creation_input_tokens: usage.cacheWrite ?? 0,
        cache_read_input_tokens: usage.cacheRead ?? 0,
      },
    },
  });
