import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { atomicWrite } from "./atomic.js";
import { readMarker } from "./marker.js";

export interface BackfillReport {
  /** Files written by this run (relative to repoPath). */
  created: string[];
  /** Files left untouched because they already exist. */
  skipped: string[];
  /** Non-fatal warnings (missing optional inputs, ambiguous data). */
  warnings: string[];
}

export interface BackfillOptions {
  repoPath: string;
}

/**
 * Backfill seed records into an existing CORE Discovery customer repo
 * that was scaffolded before the seed-on-scaffold fix landed.
 *
 * Idempotent: re-running on a fully-backfilled repo writes nothing and
 * reports everything as skipped.
 *
 * What it touches:
 *   - `data/customers/<uuid>.json` — one customer matching the marker.
 *     Only writes if `data/customers/` is empty.
 *   - `data/engagements/<uuid>.json` — one engagement per project folder
 *     under `projects/` (excluding `.gitkeep`). Only writes if no
 *     engagement already names the project.
 *   - `projects/<name>/project.json` — schema-versioned project metadata.
 *     Only writes if the file is absent.
 *   - mkdir `data/customers`, `data/engagements`, `data/discoveries`
 *     if missing.
 *
 * What it does NOT touch:
 *   - compose.yaml, .env, .env.example, README.md or anything else in
 *     the marker's files_managed list — that's the upgrade-mode job.
 *   - Existing engagements or customers in any state.
 */
export async function runBackfill(o: BackfillOptions): Promise<BackfillReport> {
  const report: BackfillReport = { created: [], skipped: [], warnings: [] };

  const marker = await readMarker(o.repoPath);
  if (marker === null) {
    throw new Error(
      `${o.repoPath} is not a CORE Discovery customer repo (no core-discovery.json marker).`,
    );
  }

  const dataDirs = ["data/customers", "data/engagements", "data/discoveries"];
  for (const d of dataDirs) {
    await mkdir(join(o.repoPath, d), { recursive: true });
  }

  // Customer seed — only if data/customers is empty
  const existingCustomers = await readJsonFiles(join(o.repoPath, "data/customers"));
  if (existingCustomers.length === 0) {
    const id = randomUUID();
    const rel = `data/customers/${id}.json`;
    await atomicWrite(
      join(o.repoPath, rel),
      JSON.stringify(
        {
          slug: marker.customer_slug,
          display_name: marker.display_name,
          industry: "",
          summary: "",
          sources: [],
          id,
        },
        null,
        2,
      ) + "\n",
    );
    report.created.push(rel);
  } else {
    report.skipped.push(`data/customers/ (${existingCustomers.length} file(s) present)`);
  }

  // Existing engagement names so we don't duplicate
  const existingEngagementNames = new Set<string>();
  for (const entry of await readJsonFiles(join(o.repoPath, "data/engagements"))) {
    if (typeof entry.name === "string") existingEngagementNames.add(entry.name);
  }

  // Walk projects/, write project.json + an engagement for each
  const projectsDir = join(o.repoPath, "projects");
  const projectEntries = await readdirIfExists(projectsDir);
  for (const projectName of projectEntries) {
    if (projectName.startsWith(".")) continue;
    const projectPath = join(projectsDir, projectName);
    if (!(await isDir(projectPath))) continue;

    // project.json
    const projectMetaPath = `projects/${projectName}/project.json`;
    const projectMetaAbs = join(o.repoPath, projectMetaPath);
    if (await fileExists(projectMetaAbs)) {
      report.skipped.push(projectMetaPath);
    } else {
      await atomicWrite(
        projectMetaAbs,
        JSON.stringify(
          {
            schema_version: "1.0.0",
            slug: slugify(projectName),
            name: projectName,
            description: "",
            tags: [],
          },
          null,
          2,
        ) + "\n",
      );
      report.created.push(projectMetaPath);
    }

    // Engagement
    if (existingEngagementNames.has(projectName)) {
      report.skipped.push(`engagement for "${projectName}"`);
      continue;
    }
    const engagementId = randomUUID();
    const now = new Date().toISOString();
    const engRel = `data/engagements/${engagementId}.json`;
    await atomicWrite(
      join(o.repoPath, engRel),
      JSON.stringify(
        {
          id: engagementId,
          slug: slugify(projectName),
          name: projectName,
          customer: marker.display_name,
          industry: "",
          summary: "",
          status: "proposed",
          repo_path: "",
          discovery_ids: [],
          owners: [],
          tags: [],
          created_by: "",
          updated_by: "",
          created_at: now,
          updated_at: now,
        },
        null,
        2,
      ) + "\n",
    );
    report.created.push(engRel);
  }

  if (projectEntries.length === 0) {
    report.warnings.push(
      "No project folders found under projects/. Customer record was written, " +
        "but no engagement was seeded. Create a project through the UI or drop a " +
        "folder into projects/<name>/ and re-run --backfill.",
    );
  }

  return report;
}

async function readJsonFiles(dir: string): Promise<Array<Record<string, unknown>>> {
  const names = await readdirIfExists(dir);
  const out: Array<Record<string, unknown>> = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(dir, name), "utf8");
      out.push(JSON.parse(raw));
    } catch {
      // skip unreadable / non-JSON
    }
  }
  return out;
}

async function readdirIfExists(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function isDir(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
