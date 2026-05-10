import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { atomicWrite } from "../src/atomic.js";

describe("atomicWrite", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "atomic-"));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("writes the contents and leaves no .tmp file behind", async () => {
    const target = join(tmp, "out.txt");
    await atomicWrite(target, "hello");
    expect(await readFile(target, "utf8")).toBe("hello");
    await expect(stat(`${target}.tmp`)).rejects.toThrow();
  });

  it("creates parent directories as needed", async () => {
    const target = join(tmp, "nested/deep/out.txt");
    await atomicWrite(target, "deep");
    expect(await readFile(target, "utf8")).toBe("deep");
  });

  it("overwrites existing files atomically", async () => {
    const target = join(tmp, "out.txt");
    await atomicWrite(target, "first");
    await atomicWrite(target, "second");
    expect(await readFile(target, "utf8")).toBe("second");
  });
});
