import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readMarker, writeMarker, type CoreDiscoveryMarker } from "../src/marker.js";

const VALID: CoreDiscoveryMarker = {
  schema_version: "1.0.0",
  customer_slug: "acme",
  display_name: "Acme",
  cli_version_created: "1.3.1",
  cli_version_last_upgrade: null,
  framework_version_pinned: "1.3.1",
  created_at: "2026-05-10T00:00:00.000Z",
  last_upgrade_at: null,
  files_managed: ["compose.yaml"],
};

describe("marker", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "marker-"));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("write + read round-trip", async () => {
    await writeMarker(tmp, VALID);
    const m = await readMarker(tmp);
    expect(m).not.toBeNull();
    expect(m!.customer_slug).toBe("acme");
    expect(m!.display_name).toBe("Acme");
  });

  it("readMarker returns null when file is absent", async () => {
    expect(await readMarker(tmp)).toBeNull();
  });

  it("readMarker throws on malformed JSON", async () => {
    await writeFile(join(tmp, "core-discovery.json"), "{not json", "utf8");
    await expect(readMarker(tmp)).rejects.toThrow(/not valid JSON/);
  });

  it("readMarker throws on Ajv failure (missing required field)", async () => {
    await writeFile(
      join(tmp, "core-discovery.json"),
      JSON.stringify({ ...VALID, customer_slug: undefined }),
      "utf8",
    );
    await expect(readMarker(tmp)).rejects.toThrow(/marker schema/);
  });

  it("writeMarker refuses a floating framework version", async () => {
    await expect(
      writeMarker(tmp, { ...VALID, framework_version_pinned: "latest" }),
    ).rejects.toThrow(/concrete SemVer/);
  });

  it("writeMarker leaves no .tmp file behind", async () => {
    await writeMarker(tmp, VALID);
    const entries = (await readFile(join(tmp, "core-discovery.json"), "utf8")).length;
    expect(entries).toBeGreaterThan(0);
  });
});
