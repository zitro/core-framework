#!/usr/bin/env node
// Copy runtime assets (JSON schemas) from src/ into dist/.
// `tsc` only emits .js for .ts inputs; non-TS files are not touched.
// Without this, the published CLI fails at startup because schemas.js
// reads dist/generated/*.schema.json.

import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");

const assets = [{ from: "src/generated", to: "dist/generated" }];

for (const { from, to } of assets) {
  const src = resolve(pkgRoot, from);
  const dst = resolve(pkgRoot, to);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`[postbuild] ${from} -> ${to}`);
}
