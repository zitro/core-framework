import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { withStaging, type StagedItem } from "../src/staging.js";

describe("withStaging", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "staging-"));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("commits all items atomically when callback returns", async () => {
    const items: StagedItem[] = [
      { target: join(tmp, "a.txt"), contents: "alpha" },
      { target: join(tmp, "nested/b.txt"), contents: "beta" },
      { target: join(tmp, "c.txt"), contents: "gamma" },
    ];
    await withStaging(items, async () => {
      // Mid-callback: tmp files exist, targets don't yet.
      await expect(stat(join(tmp, "a.txt"))).rejects.toThrow();
    });
    expect(await readFile(join(tmp, "a.txt"), "utf8")).toBe("alpha");
    expect(await readFile(join(tmp, "nested/b.txt"), "utf8")).toBe("beta");
    expect(await readFile(join(tmp, "c.txt"), "utf8")).toBe("gamma");
    const leftover = (await readdir(tmp)).filter((f) => f.endsWith(".upgrade.tmp"));
    expect(leftover).toHaveLength(0);
  });

  it("aborts and cleans up tmp files when callback throws", async () => {
    const items: StagedItem[] = [
      { target: join(tmp, "x.txt"), contents: "x" },
    ];
    await expect(
      withStaging(items, async () => {
        throw new Error("planner rejected");
      }),
    ).rejects.toThrow(/planner rejected/);
    await expect(stat(join(tmp, "x.txt"))).rejects.toThrow();
    const leftover = (await readdir(tmp)).filter((f) => f.endsWith(".upgrade.tmp"));
    expect(leftover).toHaveLength(0);
  });

  it("commits in input order (deterministic)", async () => {
    const items: StagedItem[] = [
      { target: join(tmp, "1.txt"), contents: "one" },
      { target: join(tmp, "2.txt"), contents: "two" },
      { target: join(tmp, "3.txt"), contents: "three" },
    ];
    const renamedOrder: string[] = [];
    await withStaging(items, async () => undefined, (target) => {
      renamedOrder.push(target);
    });
    expect(renamedOrder).toEqual([
      join(tmp, "1.txt"),
      join(tmp, "2.txt"),
      join(tmp, "3.txt"),
    ]);
  });
});
