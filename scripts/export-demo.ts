// 用引擎计算示例项目，导出给 docs/p0-engine.html 使用：npm run export-demo
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyze, loadPmYaml, parseEvidence, parseLedger, toPlainData } from "../src/index.js";

const FIXTURE_DIR = new URL("../tests/fixtures/kb-demo/", import.meta.url);
const OUTPUT = fileURLToPath(new URL("../docs/assets/p0-demo-data.js", import.meta.url));
const DEMO_NOW = new Date("2026-10-26T09:00:00Z");

const read = (name: string): string => readFileSync(fileURLToPath(new URL(name, FIXTURE_DIR)), "utf8");

const loaded = loadPmYaml(read("pm.yaml"));
if (!loaded.ok) {
  throw new Error(`示例 pm.yaml 无效：${loaded.errors.join("；")}`);
}

const analysis = analyze(loaded.model, {
  evidence: parseEvidence(JSON.parse(read("evidence.json"))),
  ledger: parseLedger(read("ledger.jsonl")),
  now: DEMO_NOW,
});

writeFileSync(OUTPUT, `// 由 scripts/export-demo.ts 生成，请勿手改\nwindow.P0_DEMO = ${JSON.stringify(toPlainData(analysis), null, 2)};\n`);
process.stdout.write(`已导出 ${analysis.nodes.length} 个节点的分析结果 → ${OUTPUT}\n`);
