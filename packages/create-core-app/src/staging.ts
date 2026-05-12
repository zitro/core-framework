// Batch atomic-rename helper for upgrade mode.
//
// Stage every target to <target>.upgrade.tmp + fsync. Run the
// callback (typically: validate the staged set is coherent). If
// the callback throws, clean up tmp files and re-raise. Otherwise
// rename each staged tmp into place in deterministic input order,
// fsyncing the parent dir after each rename. The marker file (if
// present) should be the LAST item — caller controls order.

import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

export interface StagedItem {
  target: string;
  contents: string;
}

async function fsyncPath(path: string): Promise<void> {
  // Best-effort: Windows + macOS reject fsync on directory handles
  // (EPERM), and a handful of network/sandboxed filesystems return
  // ENOSYS. The rename is atomic at the inode level regardless; we
  // only lose the post-crash durability guarantee.
  let handle;
  try {
    handle = await open(path, "r");
  } catch {
    return;
  }
  try {
    await handle.sync();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "ENOSYS" && code !== "EINVAL") throw err;
  } finally {
    await handle.close();
  }
}

async function writeStaged(item: StagedItem): Promise<string> {
  const tmp = `${item.target}.upgrade.tmp`;
  await mkdir(dirname(item.target), { recursive: true });
  const handle = await open(tmp, "w", 0o644);
  try {
    await handle.writeFile(item.contents, { encoding: "utf8" });
    await handle.sync();
  } catch (err) {
    // Best-effort tmp cleanup before re-raising so the failed item
    // doesn't leak a partial file.
    await handle.close().catch(() => undefined);
    await unlinkSafe(tmp);
    throw err;
  }
  await handle.close();
  return tmp;
}

async function unlinkSafe(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Already gone — fine.
  }
}

/**
 * Stage all items to tmp, run callback, then atomically rename in
 * input order. `onAfterRename` is called after each successful
 * rename — useful for test instrumentation; production callers can
 * omit it.
 */
export async function withStaging(
  items: StagedItem[],
  callback: () => Promise<void>,
  onAfterRename?: (target: string) => void,
): Promise<void> {
  const stagedPaths: string[] = [];
  try {
    for (const item of items) {
      const tmp = await writeStaged(item);
      stagedPaths.push(tmp);
    }
    await callback();
  } catch (err) {
    // Roll back any staged tmp files.
    await Promise.all(stagedPaths.map(unlinkSafe));
    throw err;
  }

  // Commit phase — atomic rename in input order. fsync parent dir
  // after each rename for crash durability.
  for (const [i, item] of items.entries()) {
    const tmp = stagedPaths[i];
    if (tmp === undefined) continue;
    await rename(tmp, item.target);
    await fsyncPath(dirname(item.target));
    onAfterRename?.(item.target);
  }
}
