// Classify a single managed file as UP_TO_DATE / MODIFIED_BY_USER
// / MISSING by re-rendering the corresponding template with
// marker-derived context and comparing to the on-disk content.
//
// Files outside the planner's known template map (e.g. .env,
// initial project README) are NOT classified here — the marker's
// files_managed list defines what the upgrade flow touches, and we
// keep that list intentionally narrow.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ScaffoldOptions } from "./scaffold.js";
import {
  composeYaml,
  envExample,
  extensionsReadme,
  gitignore,
  infraReadme,
  readme,
  renovateJson,
} from "./templates.js";

export type FileClassification =
  | { kind: "UP_TO_DATE"; expectedContent: string }
  | { kind: "MODIFIED_BY_USER"; currentContent: string; expectedContent: string }
  | { kind: "MISSING"; expectedContent: string };

export interface ClassifyArgs {
  repoPath: string;
  relativePath: string;
  ctx: ScaffoldOptions;
}

type Renderer = (o: ScaffoldOptions) => string;

// Maps the marker's relativePath to the template function that
// produces its expected content. Anything not in this map is not a
// CLI-managed framework template and gets skipped (e.g. .env, which
// holds secrets and must never be overwritten).
const RENDERERS: Record<string, Renderer> = {
  "compose.yaml": composeYaml,
  ".env.example": envExample,
  ".gitignore": () => gitignore(),
  "README.md": readme,
  "renovate.json": () => renovateJson(),
  "infra/README.md": infraReadme,
  "extensions/README.md": () => extensionsReadme(),
};

export function isManagedTemplate(relativePath: string): boolean {
  return relativePath in RENDERERS;
}

export async function classifyFile(args: ClassifyArgs): Promise<FileClassification> {
  const renderer = RENDERERS[args.relativePath];
  if (!renderer) {
    throw new Error(
      `classifyFile: no renderer for ${args.relativePath} — caller should filter via isManagedTemplate first.`,
    );
  }
  const expected = renderer(args.ctx);
  const target = join(args.repoPath, args.relativePath);
  let current: string;
  try {
    current = await readFile(target, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { kind: "MISSING", expectedContent: expected };
    }
    throw err;
  }
  if (current === expected) {
    return { kind: "UP_TO_DATE", expectedContent: expected };
  }
  return { kind: "MODIFIED_BY_USER", currentContent: current, expectedContent: expected };
}
