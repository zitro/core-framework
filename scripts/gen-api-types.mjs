#!/usr/bin/env node
/**
 * Regenerate `src/types/api.ts` from the running FastAPI OpenAPI schema.
 *
 * Steps:
 *   1. Spawn `python -c "from app.main import app; ..."` against the backend venv
 *      to dump the schema to `openapi.json` at the repo root.
 *   2. Run `openapi-typescript openapi.json -o src/types/api.ts`.
 *
 * The generated file is meant to be imported as
 *   import type { paths } from "@/types/api";
 * and used to derive request / response types instead of hand-maintaining
 * them in `src/lib/api*.ts`. Existing modules are left as-is so this can be
 * adopted incrementally.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/types/api.ts");
const schema = resolve(root, "openapi.json");

mkdirSync(dirname(out), { recursive: true });

const pythonCmd = process.env.CORE_PYTHON ?? "python";
const dump = `import json,sys; sys.path.insert(0,'backend'); from app.main import app; print(json.dumps(app.openapi()))`;

console.log("[gen:api] dumping OpenAPI schema...");
execSync(`${pythonCmd} -c "${dump}" > ${schema}`, { cwd: root, stdio: "inherit", shell: true });

if (!existsSync(schema)) {
  console.error("[gen:api] schema dump failed");
  process.exit(1);
}

console.log("[gen:api] generating typed client...");
execSync(`npx --yes openapi-typescript ${schema} -o ${out}`, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

console.log(`[gen:api] wrote ${out}`);
