import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runBackfill } from "../src/backfill.js";
import { writeMarker, type CoreDiscoveryMarker } from "../src/marker.js";

function freshMarker(): CoreDiscoveryMarker {
  return {
    schema_version: "1.0.0",
    customer_slug: "acme",
    display_name: "Acme",
    cli_version_created: "1.3.1",
    cli_version_last_upgrade: null,
    framework_version_pinned: "1.3.1",
    created_at: new Date().toISOString(),
    last_upgrade_at: null,
    files_managed: [
      "compose.yaml",
      ".gitignore",
      "README.md",
      "renovate.json",
      "infra/README.md",
      "extensions/README.md",
    ],
  };
}

describe("runBackfill", () => {
  let tmp: string;
  let repo: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "backfill-"));
    repo = join(tmp, "acme");
    await mkdir(repo, { recursive: true });
    await writeMarker(repo, freshMarker());
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("throws when the marker is missing", async () => {
    await rm(join(repo, "core-discovery.json"));
    await expect(runBackfill({ repoPath: repo })).rejects.toThrow(/not a CORE Discovery customer repo/);
  });

  it("writes a customer seed JSON when data/customers/ is empty", async () => {
    await mkdir(join(repo, "projects/Sample"), { recursive: true });
    const report = await runBackfill({ repoPath: repo });

    const customers = await readdir(join(repo, "data/customers"));
    const jsons = customers.filter((f) => f.endsWith(".json"));
    expect(jsons).toHaveLength(1);

    const seed = JSON.parse(await readFile(join(repo, "data/customers", jsons[0]), "utf8"));
    expect(seed.slug).toBe("acme");
    expect(seed.display_name).toBe("Acme");
    expect(report.created).toContain(`data/customers/${jsons[0]}`);
  });

  it("skips customer write when data/customers already has files", async () => {
    await mkdir(join(repo, "data/customers"), { recursive: true });
    await writeFile(
      join(repo, "data/customers/existing.json"),
      JSON.stringify({ slug: "acme", display_name: "Acme", id: "preexisting" }),
    );

    const report = await runBackfill({ repoPath: repo });
    const files = await readdir(join(repo, "data/customers"));
    expect(files.filter((f) => f.endsWith(".json"))).toEqual(["existing.json"]);
    expect(report.skipped.some((s) => s.startsWith("data/customers/"))).toBe(true);
  });

  it("writes project.json + engagement for each project folder", async () => {
    await mkdir(join(repo, "projects/Lalita Ai"), { recursive: true });
    await mkdir(join(repo, "projects/Beta Project"), { recursive: true });

    const report = await runBackfill({ repoPath: repo });

    const projectMeta = JSON.parse(
      await readFile(join(repo, "projects/Lalita Ai/project.json"), "utf8"),
    );
    expect(projectMeta.schema_version).toBe("1.0.0");
    expect(projectMeta.slug).toBe("lalita-ai");
    expect(projectMeta.name).toBe("Lalita Ai");

    const engagements = await readdir(join(repo, "data/engagements"));
    const eJsons = engagements.filter((f) => f.endsWith(".json"));
    expect(eJsons).toHaveLength(2);

    const eRecords = await Promise.all(
      eJsons.map(async (f) =>
        JSON.parse(await readFile(join(repo, "data/engagements", f), "utf8")),
      ),
    );
    const names = eRecords.map((r) => r.name).sort();
    expect(names).toEqual(["Beta Project", "Lalita Ai"]);
    for (const r of eRecords) {
      expect(r.customer).toBe("Acme");
      expect(r.status).toBe("proposed");
      expect(r.discovery_ids).toEqual([]);
    }
    expect(report.created.filter((f) => f.startsWith("data/engagements/"))).toHaveLength(2);
  });

  it("does not duplicate engagements when one already exists for the project", async () => {
    await mkdir(join(repo, "projects/Lalita Ai"), { recursive: true });
    await mkdir(join(repo, "data/engagements"), { recursive: true });
    await writeFile(
      join(repo, "data/engagements/existing.json"),
      JSON.stringify({ id: "x", name: "Lalita Ai", slug: "lalita-ai", customer: "Acme" }),
    );

    const report = await runBackfill({ repoPath: repo });

    const engagements = await readdir(join(repo, "data/engagements"));
    expect(engagements.filter((f) => f.endsWith(".json"))).toEqual(["existing.json"]);
    expect(report.skipped.some((s) => s.includes("Lalita Ai"))).toBe(true);
  });

  it("does not overwrite a project.json that already exists", async () => {
    await mkdir(join(repo, "projects/Lalita Ai"), { recursive: true });
    await writeFile(
      join(repo, "projects/Lalita Ai/project.json"),
      JSON.stringify({ schema_version: "1.0.0", slug: "lalita-ai", name: "Lalita Ai" }),
    );

    const report = await runBackfill({ repoPath: repo });
    expect(report.skipped).toContain("projects/Lalita Ai/project.json");
  });

  it("is idempotent: running twice produces no new files on the second run", async () => {
    await mkdir(join(repo, "projects/Sample"), { recursive: true });

    const first = await runBackfill({ repoPath: repo });
    expect(first.created.length).toBeGreaterThan(0);

    const second = await runBackfill({ repoPath: repo });
    expect(second.created).toEqual([]);
  });

  it("emits a warning when projects/ is empty", async () => {
    const report = await runBackfill({ repoPath: repo });
    expect(report.warnings.some((w) => w.includes("No project folders found"))).toBe(true);
  });

  it("creates the data/discoveries directory even when nothing is written there", async () => {
    await runBackfill({ repoPath: repo });
    const entries = await readdir(join(repo, "data"));
    expect(entries).toContain("discoveries");
  });
});
