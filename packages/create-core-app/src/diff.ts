// Render a unified diff for the upgrade preview. Colorizes added /
// removed lines for terminal output. Annotates `(new file)` when
// the before content is empty.

import { createTwoFilesPatch } from "diff";

import pc from "picocolors";

export interface RenderUnifiedDiffArgs {
  filePath: string;
  before: string;
  after: string;
}

export function renderUnifiedDiff(args: RenderUnifiedDiffArgs): string {
  const isNew = args.before.length === 0;
  const header = isNew ? `${args.filePath} (new file)` : args.filePath;

  const patch = createTwoFilesPatch(
    args.filePath,
    args.filePath,
    args.before,
    args.after,
    "before",
    "after",
    { context: 3 },
  );

  // The diff library always emits four header lines before any
  // hunks (Index, ===, ---, +++). Slice from the first `@@` so we
  // never depend on the exact header line count, and degrade to an
  // empty body when before === after (no hunks).
  const lines = patch.split("\n");
  const hunkStart = lines.findIndex((l) => l.startsWith("@@"));
  const body = hunkStart >= 0 ? lines.slice(hunkStart).join("\n") : "";

  const colorized = body
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) return pc.green(line);
      if (line.startsWith("-") && !line.startsWith("---")) return pc.red(line);
      if (line.startsWith("@@")) return pc.cyan(line);
      return line;
    })
    .join("\n");

  return `${pc.bold(header)}\n${colorized}`;
}
