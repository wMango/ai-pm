// 把 CLI 打包成插件里的单个文件：npm run build:plugin
// 产物：plugin/bin/pm.mjs（依赖已内联）+ plugin/bin/client/（dashboard 页面用的样式与脚本）
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));
const BIN_DIR = root("plugin/bin");

rmSync(BIN_DIR, { recursive: true, force: true });
await build({
  entryPoints: [root("src/cli.ts")],
  outfile: `${BIN_DIR}/pm.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // yaml 的 CommonJS 代码里有 require，ESM 产物需要一个 require 垫片
  banner: { js: '#!/usr/bin/env node\n// 由 scripts/build-plugin.ts 生成，请勿手改\nimport { createRequire as __pmCreateRequire } from "node:module";\nconst require = __pmCreateRequire(import.meta.url);' },
  minify: true,
  legalComments: "none",
});
cpSync(root("src/dashboard/client"), `${BIN_DIR}/client`, { recursive: true });
process.stdout.write(`已构建 ${BIN_DIR}/pm.mjs\n`);
