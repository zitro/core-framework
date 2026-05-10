// Ajv validators compiled from the generated JSON Schemas. The
// schemas themselves are owned by backend/app/schemas/ (Pydantic
// source of truth) and copied here via `pnpm gen:schemas`. Drift is
// caught by `pnpm check:schemas` in CI.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = resolve(here, "generated");

function loadSchema(name: string): object {
  return JSON.parse(readFileSync(resolve(GENERATED_DIR, name), "utf8"));
}

// Single Ajv instance — compiled schemas are cached on the instance.
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validateMarker = ajv.compile(loadSchema("core_discovery_marker.schema.json"));

export interface ValidationFailure {
  path: string;
  message: string;
}

export interface ValidationOk {
  ok: true;
}
export interface ValidationErr {
  ok: false;
  errors: ValidationFailure[];
}
export type ValidationResult = ValidationOk | ValidationErr;

function shape(errors: ErrorObject[] | null | undefined): ValidationFailure[] {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || "/",
    message: e.message ?? "invalid",
  }));
}

export function validateCoreDiscoveryMarker(payload: unknown): ValidationResult {
  if (validateMarker(payload)) return { ok: true };
  return { ok: false, errors: shape(validateMarker.errors) };
}

// Mirrors backend's _refuse_floating_tags + _assert_semver — JSON
// Schema can't express it, so we mirror it here for client-side
// guarding before write.
const FLOATING_TAGS = new Set(["latest", "main", "master", "edge"]);
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(\+[\w.-]+)?$/;

export function assertConcreteSemverTag(value: string, fieldName: string): void {
  if (FLOATING_TAGS.has(value.toLowerCase())) {
    throw new Error(
      `${fieldName} must be a concrete SemVer tag, not a floating reference like ${JSON.stringify(value)}.`,
    );
  }
  if (!SEMVER_RE.test(value)) {
    throw new Error(
      `${fieldName} must match SemVer (e.g. 1.4.0); got ${JSON.stringify(value)}.`,
    );
  }
}
