import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readMarker } from "../src/marker.js";
import { scaffold, type ScaffoldOptions } from "../src/scaffold.js";
import { runUpgradeMode } from "../src/upgrade.js";

function baseOpts(target: string): ScaffoldOptions {
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
  };
}

describe("upgrade end-to-end", () => {
  let tmp: string;
  let target: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "upgrade-e2e-"));
    target = join(tmp, "acme");
    await scaffold(baseOpts(target));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("a freshly-scaffolded repo is up-to-date (no-op upgrade)", async () => {
    const result = await runUpgradeMode({
      repoPath: target,
      confirm: () => Promise.resolve(true),
    });
    expect(result.applied).toEqual([]);
    expect(result.aborted).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("restores a managed file after the user corrupts it (confirm=true)", async () => {
    const composePath = join(target, "compose.yaml");
    const original = await readFile(composePath, "utf8");
    await writeFile(composePath, "user broke this\n", "utf8");

    const result = await runUpgradeMode({
      repoPath: target,
      confirm: () => Promise.resolve(true),
    });
    expect(result.applied).toContain("compose.yaml");
    const restored = await readFile(composePath, "utf8");
    expect(restored).toBe(original);
  });

  it("declining the gate aborts cleanly and leaves files untouched", async () => {
    const composePath = join(target, "compose.yaml");
    await writeFile(composePath, "user broke this\n", "utf8");

    const result = await runUpgradeMode({
      repoPath: target,
      confirm: () => Promise.resolve(false),
    });
    expect(result.aborted).toBe(true);
    expect(result.applied).toEqual([]);
    expect(await readFile(composePath, "utf8")).toBe("user broke this\n");
  });

  it("bumps cli_version_last_upgrade + last_upgrade_at on successful apply", async () => {
    await writeFile(join(target, "compose.yaml"), "user broke this\n", "utf8");
    await runUpgradeMode({
      repoPath: target,
      confirm: () => Promise.resolve(true),
    });
    const marker = await readMarker(target);
    expect(marker!.cli_version_last_upgrade).toBe("1.3.1");
    expect(typeof marker!.last_upgrade_at).toBe("string");
    expect(marker!.last_upgrade_at).not.toBeNull();
  });

  it("does not call onBeforeCommit when the plan is empty", async () => {
    let count = 0;
    await runUpgradeMode({
      repoPath: target,
      confirm: () => Promise.resolve(true),
      onBeforeCommit: () => {
        count += 1;
      },
    });
    expect(count).toBe(0);
  });

  it("calls onBeforeCommit exactly once when the user accepts a non-empty plan", async () => {
    await writeFile(join(target, "compose.yaml"), "user broke this\n", "utf8");
    let count = 0;
    await runUpgradeMode({
      repoPath: target,
      confirm: () => Promise.resolve(true),
      onBeforeCommit: () => {
        count += 1;
      },
    });
    expect(count).toBe(1);
  });

  it("emits a warning for files_managed entries the renderer doesn't know", async () => {
    // Hand-corrupt the marker to include an unknown path.
    const markerPath = join(target, "core-discovery.json");
    const marker = JSON.parse(await readFile(markerPath, "utf8"));
    marker.files_managed.push("something/unknown.txt");
    await writeFile(markerPath, JSON.stringify(marker, null, 2) + "\n", "utf8");

    const result = await runUpgradeMode({
      repoPath: target,
      confirm: () => Promise.resolve(true),
    });
    expect(result.warnings.some((w) => w.includes("something/unknown.txt"))).toBe(true);
  });
});
