// Read / write of the customer-repo marker file. The marker is
// what distinguishes a CORE Discovery customer directory from any
// other folder — its presence (plus a valid schema_version) is the
// signal that upgrade mode is safe to run.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { atomicWrite } from "./atomic.js";
import { assertConcreteSemverTag, validateCoreDiscoveryMarker } from "./schemas.js";

export interface CoreDiscoveryMarker {
  schema_version: "1.0.0";
  customer_slug: string;
  display_name: string;
  cli_version_created: string;
  cli_version_last_upgrade: string | null;
  framework_version_pinned: string;
  created_at: string;
  last_upgrade_at: string | null;
  files_managed: string[];
}

const FILENAME = "core-discovery.json";

/**
 * Read the marker from a customer repo. Returns null if absent,
 * throws with a descriptive error on malformed JSON or Ajv failure
 * (so an unknown directory is distinguishable from a corrupt one).
 */
export async function readMarker(repoPath: string): Promise<CoreDiscoveryMarker | null> {
  let raw: string;
  try {
    raw = await readFile(join(repoPath, FILENAME), "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `core-discovery.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const r = validateCoreDiscoveryMarker(parsed);
  if (!r.ok) {
    const detail = r.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
    throw new Error(`core-discovery.json does not match the marker schema: ${detail}`);
  }
  return parsed as CoreDiscoveryMarker;
}

/**
 * Write the marker atomically. Floating-tag refusal isn't in the
 * JSON Schema (Pydantic-only), so we mirror that guard here before
 * Ajv validates the rest of the shape.
 */
export async function writeMarker(repoPath: string, payload: CoreDiscoveryMarker): Promise<void> {
  assertConcreteSemverTag(payload.framework_version_pinned, "framework_version_pinned");
  assertConcreteSemverTag(payload.cli_version_created, "cli_version_created");
  if (payload.cli_version_last_upgrade !== null) {
    assertConcreteSemverTag(payload.cli_version_last_upgrade, "cli_version_last_upgrade");
  }
  const r = validateCoreDiscoveryMarker(payload);
  if (!r.ok) {
    const detail = r.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
    throw new Error(`core-discovery.json failed schema validation: ${detail}`);
  }
  await atomicWrite(join(repoPath, FILENAME), JSON.stringify(payload, null, 2) + "\n");
}
