#!/usr/bin/env node
/**
 * CI gate: re-run scripts/gen-schemas.mjs into a snapshot, diff
 * against the committed artifacts, exit 1 on drift. Catches
 * Pydantic edits that didn't include a `pnpm gen:schemas` regen.
 *
 * Subprocess discipline: execFileSync with array args; no shell.
 */

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trackedDir = resolve(root, "packages/create-core-app/src/generated");

const tmp = mkdtempSync(resolve(tmpdir(), "core-schemas-"));
const snapshotDir = resolve(tmp, "snapshot");
mkdirSync(snapshotDir, { recursive: true });

function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...listFiles(resolve(dir, entry.name), rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = resolve(src, entry.name);
    const d = resolve(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

try {
  copyTree(trackedDir, snapshotDir);
  execFileSync("pnpm", ["gen:schemas"], { cwd: root, stdio: "inherit" });

  const freshFiles = listFiles(trackedDir).sort();
  const oldFiles = listFiles(snapshotDir).sort();

  let drift = false;
  if (freshFiles.length !== oldFiles.length || freshFiles.some((f, i) => f !== oldFiles[i])) {
    console.error(
      `[check:schemas] file set changed:\n  before: ${oldFiles.join(", ")}\n  after:  ${freshFiles.join(", ")}`,
    );
    drift = true;
  }

  for (const f of freshFiles) {
    const fresh = readFileSync(resolve(trackedDir, f), "utf8");
    const old = oldFiles.includes(f) ? readFileSync(resolve(snapshotDir, f), "utf8") : "";
    if (fresh !== old) {
      console.error(`[check:schemas] drift in ${f}`);
      drift = true;
    }
  }

  // Restore the snapshot so the working tree is byte-identical to
  // what the developer had checked out. CI runs in a fresh clone so
  // this is moot for the build, but matters for `pnpm check:schemas`
  // on a dev machine.
  rmSync(trackedDir, { recursive: true, force: true });
  copyTree(snapshotDir, trackedDir);

  if (drift) {
    console.error(
      "[check:schemas] generated artifacts are stale; run `pnpm gen:schemas` and commit.",
    );
    process.exit(1);
  }
  console.log("[check:schemas] no drift.");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
