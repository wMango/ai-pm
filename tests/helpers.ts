import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPmYaml, validateModel, parseEvidence, parseLedger } from "../src/index.js";
import type { Evidence, LedgerEntry, PmModel } from "../src/index.js";

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/kb-demo/${name}`, import.meta.url)), "utf8");

export const DEMO_NOW = new Date("2026-10-26T09:00:00Z");

export interface Demo {
  model: PmModel;
  evidence: Evidence;
  ledger: LedgerEntry[];
}

export const loadDemo = (): Demo => {
  const loaded = loadPmYaml(fixture("pm.yaml"));
  if (!loaded.ok) throw new Error(`fixture 无效：${loaded.errors.join("；")}`);
  return {
    model: loaded.model,
    evidence: parseEvidence(JSON.parse(fixture("evidence.json"))),
    ledger: parseLedger(fixture("ledger.jsonl")),
  };
};

/** 用对象快速构造小模型；校验失败直接抛错，方便测试聚焦在计算上 */
export const model = (raw: Record<string, unknown>): PmModel => {
  const result = validateModel({ version: 1, project: "t", ...raw });
  if (!result.ok) throw new Error(result.errors.join("；"));
  return result.model;
};

export const done = (total = 1): { passed: number; total: number; pendingReview: boolean } => ({ passed: total, total, pendingReview: false });
export const failing = (): { passed: number; total: number; pendingReview: boolean } => ({ passed: 0, total: 1, pendingReview: false });
