// Atomic single-file writer. Writes to <target>.tmp, fsyncs the file
// + the parent directory, then renames. Survives a crash between the
// data write and the rename — the partial tmp gets cleaned up on
// next operation and the target is either fully old or fully new.

import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

async function fsyncDir(path: string): Promise<void> {
  // Best-effort: macOS rejects fsync on read-only directory handles
  // with EPERM, and a handful of network/sandboxed filesystems return
  // ENOSYS. The rename is atomic at the inode level on APFS/ext4
  // regardless; we only lose the post-crash durability guarantee.
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

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Already gone — fine.
  }
}

/**
 * Write ``contents`` to ``target`` atomically. Parent directory is
 * created if missing. On success the target is replaced; on failure
 * any partial tmp file is cleaned up.
 */
export async function atomicWrite(target: string, contents: string): Promise<void> {
  const tmp = `${target}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  const handle = await open(tmp, "w", 0o644);
  try {
    await handle.writeFile(contents, { encoding: "utf8" });
    await handle.sync();
  } catch (err) {
    await handle.close().catch(() => undefined);
    await unlinkIfPresent(tmp);
    throw err;
  }
  await handle.close();
  await rename(tmp, target);
  await fsyncDir(dirname(target));
}
