// Upgrade orchestrator.
//
// 1. Read marker.
// 2. Build plan: classify every file in files_managed, drop
//    UP_TO_DATE entries, raise for files whose renderer this CLI
//    doesn't know (the marker came from a newer CLI).
// 3. Render the diff preview as the sole confirmation gate.
// 4. Stage writes via withStaging; on confirm, atomic-rename.
// 5. Update marker LAST as a separate write — a crash between
//    content commit and marker bump leaves the repo self-healing on
//    rerun (planner re-classifies content as UP_TO_DATE, only the
//    marker needs updating).

import { join } from "node:path";

import {
  classifyFile,
  isManagedTemplate,
  type FileClassification,
} from "./classifier.js";
import { renderUnifiedDiff } from "./diff.js";
import { readMarker, writeMarker, type CoreDiscoveryMarker } from "./marker.js";
import type { ScaffoldOptions } from "./scaffold.js";
import { withStaging, type StagedItem } from "./staging.js";
import { CLI_VERSION } from "./version.js";

export type ActionKind = "create-missing" | "modified-by-user" | "skip-up-to-date";

export interface UpgradeAction {
  relativePath: string;
  action: ActionKind;
  classification: FileClassification;
}

export interface UpgradePlan {
  actions: UpgradeAction[];
  warnings: string[];
}

export interface RunUpgradeArgs {
  repoPath: string;
  /** Sole confirmation gate. Resolve true to commit, false to abort. */
  confirm: (preview: string) => Promise<boolean>;
  /** Optional sink for the diff preview text; tests usually ignore. */
  printPreview?: (preview: string) => void;
  /** Fired once after confirm returns true, before staging begins. */
  onBeforeCommit?: () => void | Promise<void>;
}

export interface UpgradeResult {
  applied: string[];
  aborted: boolean;
  warnings: string[];
}

/**
 * Re-derive a ScaffoldOptions from the marker. Provider knobs are
 * not stored in the marker (they live in .env) so we fall back to
 * the same defaults the local-only setup uses. Only the managed
 * templates (those in the classifier's RENDERERS table) are valid
 * targets — none of them consume the provider knobs.
 */
function deriveCtx(marker: CoreDiscoveryMarker): ScaffoldOptions {
  return {
    target: "",
    name: marker.customer_slug,
    displayName: marker.display_name,
    version: marker.framework_version_pinned,
    llm: "local",
    openaiModel: "gpt-4o",
    openaiBaseUrl: "",
    speech: "none",
    openaiTranscriptionModel: "gpt-4o-transcribe",
    openaiTranscriptionBaseUrl: "",
    storage: "local",
    auth: "none",
  };
}

export async function buildUpgradePlan(
  repoPath: string,
  marker: CoreDiscoveryMarker,
): Promise<UpgradePlan> {
  const ctx = deriveCtx(marker);
  const actions: UpgradeAction[] = [];
  const warnings: string[] = [];

  for (const rel of marker.files_managed) {
    if (!isManagedTemplate(rel)) {
      warnings.push(
        `Marker lists ${rel} in files_managed but this CLI version doesn't know how to render it; skipping.`,
      );
      continue;
    }
    const classification = await classifyFile({
      repoPath,
      relativePath: rel,
      ctx,
    });
    let action: ActionKind;
    switch (classification.kind) {
      case "UP_TO_DATE":
        action = "skip-up-to-date";
        break;
      case "MISSING":
        action = "create-missing";
        break;
      case "MODIFIED_BY_USER":
        action = "modified-by-user";
        break;
    }
    actions.push({ relativePath: rel, action, classification });
  }

  return { actions, warnings };
}

export async function runUpgradeMode(args: RunUpgradeArgs): Promise<UpgradeResult> {
  const marker = await readMarker(args.repoPath);
  if (marker === null) {
    throw new Error(`No core-discovery.json found at ${args.repoPath}; cannot upgrade.`);
  }

  const plan = await buildUpgradePlan(args.repoPath, marker);
  const writableActions = plan.actions.filter((a) => a.action !== "skip-up-to-date");

  if (writableActions.length === 0) {
    return { applied: [], aborted: false, warnings: plan.warnings };
  }

  // Build the preview.
  const previewParts: string[] = [];
  for (const a of writableActions) {
    const before =
      a.classification.kind === "MODIFIED_BY_USER" ? a.classification.currentContent : "";
    previewParts.push(
      renderUnifiedDiff({
        filePath: a.relativePath,
        before,
        after: a.classification.expectedContent,
      }),
    );
  }
  const preview = previewParts.join("\n\n");
  args.printPreview?.(preview);

  const ok = await args.confirm(preview);
  if (!ok) {
    return { applied: [], aborted: true, warnings: plan.warnings };
  }

  await args.onBeforeCommit?.();

  // Stage + commit content.
  const items: StagedItem[] = writableActions.map((a) => ({
    target: join(args.repoPath, a.relativePath),
    contents: a.classification.expectedContent,
  }));
  await withStaging(items, async () => {
    // Classifier already invoked the renderer per file. No additional
    // batch-level coherence check today.
  });

  // Marker LAST — separate write outside the batch.
  const updatedMarker: CoreDiscoveryMarker = {
    ...marker,
    cli_version_last_upgrade: CLI_VERSION,
    last_upgrade_at: new Date().toISOString(),
  };
  await writeMarker(args.repoPath, updatedMarker);

  return {
    applied: writableActions.map((a) => a.relativePath),
    aborted: false,
    warnings: plan.warnings,
  };
}
