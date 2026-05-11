import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scaffold, type ScaffoldOptions } from "../src/scaffold.js";

function baseOpts(target: string, overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
  return {
    target,
    name: "acme",
    displayName: "Acme",
    version: "1.3.1",
    llm: "local",
    openaiModel: "gpt-4o",
    openaiBaseUrl: "",
    speech: "none",
    openaiTranscriptionModel: "gpt-4o-transcribe",
    openaiTranscriptionBaseUrl: "",
    storage: "local",
    auth: "none",
    contentSource: "local",
    projectsSource: "./projects",
    localDataPath: "./data",
    ...overrides,
  };
}

describe("scaffold seed records", () => {
  let tmp: string;
  let target: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "scaffold-seed-"));
    target = join(tmp, "acme");
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("creates data/customers/ and writes a customer seed JSON", async () => {
    await scaffold(baseOpts(target));

    const customers = await readdir(join(target, "data/customers"));
    const jsons = customers.filter((f) => f.endsWith(".json"));
    expect(jsons).toHaveLength(1);

    const seed = JSON.parse(
      await readFile(join(target, "data/customers", jsons[0]), "utf8"),
    );
    expect(seed.slug).toBe("acme");
    expect(seed.display_name).toBe("Acme");
    expect(seed.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("creates data/engagements/ and writes an engagement seed when initialProject is provided", async () => {
    await scaffold(baseOpts(target, { initialProject: "Lalita Ai" }));

    const engagements = await readdir(join(target, "data/engagements"));
    const jsons = engagements.filter((f) => f.endsWith(".json"));
    expect(jsons).toHaveLength(1);

    const seed = JSON.parse(
      await readFile(join(target, "data/engagements", jsons[0]), "utf8"),
    );
    expect(seed.slug).toBe("lalita-ai");
    expect(seed.name).toBe("Lalita Ai");
    expect(seed.customer).toBe("Acme");
    expect(seed.status).toBe("proposed");
    expect(seed.discovery_ids).toEqual([]);
  });

  it("writes a schema-versioned project.json next to the project README", async () => {
    await scaffold(baseOpts(target, { initialProject: "Lalita Ai" }));

    const meta = JSON.parse(
      await readFile(join(target, "projects/Lalita Ai/project.json"), "utf8"),
    );
    expect(meta.schema_version).toBe("1.0.0");
    expect(meta.slug).toBe("lalita-ai");
    expect(meta.name).toBe("Lalita Ai");
    expect(meta.description).toBe("");
    expect(meta.tags).toEqual([]);
  });

  it("does not write an engagement seed when no initialProject is provided", async () => {
    await scaffold(baseOpts(target));

    const engagements = await readdir(join(target, "data/engagements"));
    const jsons = engagements.filter((f) => f.endsWith(".json"));
    expect(jsons).toEqual([]);
  });

  it("creates data/discoveries/ as an empty seed dir", async () => {
    await scaffold(baseOpts(target));
    const s = await stat(join(target, "data/discoveries"));
    expect(s.isDirectory()).toBe(true);
  });

  it("pins both backend and frontend to linux/amd64 in compose.yaml", async () => {
    await scaffold(baseOpts(target));
    const compose = await readFile(join(target, "compose.yaml"), "utf8");
    const platformLines = compose.split("\n").filter((l) => l.includes("platform: linux/amd64"));
    expect(platformLines).toHaveLength(2);
  });
});
