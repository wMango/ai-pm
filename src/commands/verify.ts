// pm verify：运行验收测试，写出 .pm/evidence.json
import { isPendingReview, parseLocks } from "../workflow/locks.js";
import { runAcceptance } from "../workflow/runner.js";
import type { Evidence, NodeEvidence, PmModel } from "../schema.js";
import { allNodes } from "../graph.js";
import { EXIT, UsageError, loadModel, parseArgs, pmPaths, readEvidence, readOptional, writeJson } from "./shared.js";
import type { Command, PmPaths } from "./shared.js";

export interface VerifyResult {
  evidence: Evidence;
  lines: string[];
  warnings: string[];
}

/** 运行选中节点的验收测试，返回合并后的验收结果（不写文件） */
export const runVerify = (paths: PmPaths, model: PmModel, only: readonly string[] | null): VerifyResult => {
  const locks = parseLocks(readOptional(paths.file("locks.json")));
  const { runners, testTimeoutSec } = model.settings;
  const targets = allNodes(model).filter(({ node }) => (node.acceptance.length || node.spec) && (!only || only.includes(node.id)));
  const warnings: string[] = [];
  const lines: string[] = [];
  const fresh = targets.map(({ node, view }): [string, NodeEvidence] => {
    const results = node.acceptance.map((path) => runAcceptance(paths.root, path, runners, testTimeoutSec));
    results.forEach((r) => r.warning && warnings.push(r.warning));
    const passed = results.filter((r) => r.ok).length;
    const pendingReview = isPendingReview(paths.root, node, locks[node.id], runners, view === "functional");
    lines.push(`${node.id} ${node.name}：${passed}/${results.length}${pendingReview ? " · 待复核" : ""}`);
    return [node.id, { passed, total: results.length, pendingReview }];
  });
  const previous = only ? readEvidence(paths) : {};
  return { evidence: { ...previous, ...Object.fromEntries(fresh) }, lines, warnings };
};

export const verify: Command = (args, io) => {
  const { options } = parseArgs(args, { options: ["--dir", "--only"] });
  const only = options["--only"] ? options["--only"].split(",").map((s) => s.trim()).filter(Boolean) : null;
  if (only && !only.length) throw new UsageError("--only 需要至少一个节点 id");
  const paths = pmPaths(io.cwd, options["--dir"]);
  const { model } = loadModel(paths);
  const result = runVerify(paths, model, only);
  writeJson(paths.file("evidence.json"), result.evidence);
  result.warnings.forEach((w) => io.err(`警告：${w}\n`));
  io.out(`${result.lines.join("\n") || "没有需要验收的节点"}\n`);
  return EXIT.ok;
};
