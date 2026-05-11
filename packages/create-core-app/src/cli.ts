#!/usr/bin/env node
import { intro, outro, text, select, confirm, isCancel, cancel, spinner, note } from "@clack/prompts";
import pc from "picocolors";
import { existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";

import { readMarker } from "./marker.js";
import { runBackfill } from "./backfill.js";
import { scaffold } from "./scaffold.js";
import { runUpgradeMode, type UpgradeResult } from "./upgrade.js";
import { LATEST_VERSION } from "./version.js";

// Slug rules mirror the backend's customer_slug pattern. Lowercase
// alphanumerics with optional hyphens — anything else corrupts the
// scaffolded compose container name and breaks Pydantic validation.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

// Concrete SemVer only — reject `latest`, `main`, `master`, and any
// leading-v form. Mirrors the runtime guard added in the engagement.
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
const FLOATING_TAGS = new Set(["latest", "main", "master", "edge"]);

function validateSlug(value: string): string | undefined {
  if (!value) return "Name required";
  if (!SLUG_RE.test(value)) return "Lowercase alnum + hyphens only";
  return undefined;
}

function validateFrameworkVersion(value: string): string | undefined {
  if (!value) return "Version required";
  if (FLOATING_TAGS.has(value.toLowerCase())) {
    return `Floating tag '${value}' rejected — pin to a concrete SemVer (e.g. 1.3.1)`;
  }
  if (!SEMVER_RE.test(value)) {
    return `Must match SemVer X.Y.Z (no leading 'v', no '${value}')`;
  }
  return undefined;
}

async function main(): Promise<void> {
  intro(pc.cyan("◆ create-core-discovery-app"));

  // --backfill <path>: write missing data/customers, data/engagements,
  // and projects/<name>/project.json into a pre-existing customer repo
  // that was scaffolded before the seed-on-scaffold fix. Idempotent.
  if (process.argv[2] === "--backfill") {
    const targetArg = process.argv[3]?.trim();
    if (!targetArg) {
      cancel("Usage: create-core-discovery-app --backfill <path-to-customer-repo>");
      process.exit(1);
    }
    const target = resolve(process.cwd(), targetArg);
    if (!existsSync(target)) {
      cancel(`Path does not exist: ${target}`);
      process.exit(1);
    }
    const s = spinner();
    s.start("Backfilling seed records");
    try {
      const report = await runBackfill({ repoPath: target });
      s.stop("Backfill complete");

      if (report.created.length === 0) {
        note(pc.dim("Nothing to write — repo is already fully seeded."), "no changes");
      } else {
        note(
          report.created.map((f) => `${pc.green("+")} ${f}`).join("\n"),
          `wrote ${report.created.length} file(s)`,
        );
      }
      if (report.skipped.length > 0) {
        note(
          report.skipped.map((f) => `${pc.dim("·")} ${f}`).join("\n"),
          `skipped ${report.skipped.length}`,
        );
      }
      for (const w of report.warnings) {
        note(pc.yellow(w), "warning");
      }

      outro(pc.green("done"));
      process.exit(0);
    } catch (err) {
      s.stop("Backfill failed");
      cancel(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  const argName = process.argv[2]?.trim();
  if (argName !== undefined) {
    const err = validateSlug(argName);
    if (err) {
      cancel(`Invalid customer name '${argName}': ${err}`);
      process.exit(1);
    }
  }
  const name = argName ?? (await prompt(text({
    message: "Customer name (also the directory name):",
    placeholder: "acme",
    validate: validateSlug,
  })));

  const target = resolve(process.cwd(), name);
  if (existsSync(target)) {
    // Existing directory: look for the marker. If present, dispatch
    // to upgrade mode. If absent, refuse — we don't know what this
    // directory is and we won't overwrite it.
    const marker = await readMarker(target);
    if (marker === null) {
      cancel(
        `Directory ${pc.bold(name)} exists but is not a CORE Discovery customer repo (no core-discovery.json marker found).`,
      );
      process.exit(1);
    }

    const proceed = await prompt(confirm({
      message: `Upgrade existing repo at ${pc.bold("./" + name)} (last touched by CLI ${marker.cli_version_last_upgrade ?? marker.cli_version_created})?`,
      initialValue: true,
    }));
    if (!proceed) {
      cancel("Aborted.");
      process.exit(0);
    }

    const upgradeSpinner = spinner();
    let spinnerActive = true;
    upgradeSpinner.start("Planning upgrade…");
    let result!: UpgradeResult;
    try {
      result = await runUpgradeMode({
        repoPath: target,
        confirm: async (preview) => {
          upgradeSpinner.stop("Plan ready.");
          spinnerActive = false;
          note(preview, "Pending changes");
          return await prompt(confirm({
            message: "Apply these changes?",
            initialValue: true,
          }));
        },
        onBeforeCommit: () => {
          upgradeSpinner.start("Applying changes…");
          spinnerActive = true;
        },
      });
    } catch (err) {
      if (spinnerActive) {
        upgradeSpinner.stop("Failed");
        spinnerActive = false;
      }
      cancel(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    if (spinnerActive) {
      // Either the no-op-plan path (confirm never fired) or the
      // commit-completed path (onBeforeCommit restarted the
      // spinner). Stop with a message that matches the outcome.
      const stopMessage =
        result.applied.length === 0
          ? "No changes needed."
          : `Applied ${result.applied.length} file(s).`;
      upgradeSpinner.stop(stopMessage);
      spinnerActive = false;
    }

    if (result.warnings.length > 0) {
      note(result.warnings.join("\n"), "Warnings");
    }
    if (result.aborted) {
      cancel("Upgrade aborted.");
      process.exit(0);
    }
    if (result.applied.length === 0) {
      outro(pc.green("Already up to date."));
      process.exit(0);
    }
    note(
      result.applied.map((p) => `- ${p}`).join("\n"),
      `Updated ${result.applied.length} file(s)`,
    );
    outro(pc.green("Upgrade complete."));
    process.exit(0);
  }

  const displayName = await prompt(text({
    message: "Display name (shown in UI / README):",
    placeholder: name.charAt(0).toUpperCase() + name.slice(1),
    initialValue: name.charAt(0).toUpperCase() + name.slice(1),
  }));

  const setupMode = (await prompt(select({
    message: "Initial setup mode:",
    options: [
      {
        value: "local-only",
        label: "Local-only (no Azure/external services)",
        hint: "recommended for quick start",
      },
      {
        value: "service-integrated",
        label: "Service-integrated (configure AI/storage/auth providers)",
      },
    ],
    initialValue: "local-only" as "local-only" | "service-integrated",
  }))) as "local-only" | "service-integrated";

  let llm: "local" | "azure" | "openai" = "local";
  let openaiModel = "gpt-4o";
  let openaiBaseUrl = "";
  let speech: "none" | "azure" | "openai" = "none";
  let openaiTranscriptionModel = "gpt-4o-transcribe";
  let openaiTranscriptionBaseUrl = "";
  let storage: "local" | "azure" = "local";
  let auth: "none" | "azure" = "none";
  let localDataPath = "./data";
  let createLocalDataFolder = true;

  if (setupMode === "local-only") {
    note(
      [
        "Using local defaults:",
        "- LLM_PROVIDER=local",
        "- STORAGE_PROVIDER=local",
        "- AUTH_PROVIDER=none",
        "- SPEECH_PROVIDER=none",
      ].join("\n"),
      "Local-only profile",
    );
  } else {
    llm = (await prompt(select({
      message: "AI provider:",
      options: [
        { value: "local", label: "local (Ollama / dev)", hint: "no Azure required" },
        { value: "azure", label: "azure (Azure OpenAI)" },
        { value: "openai", label: "openai-compatible API", hint: "OpenAI, Claude, Gemini, Grok, or custom endpoint" },
      ],
      initialValue: "azure" as "local" | "azure" | "openai",
    }))) as "local" | "azure" | "openai";

    if (llm === "openai") {
      const llmPreset = (await prompt(select({
        message: "Select model family:",
        options: [
          { value: "openai", label: "OpenAI", hint: "api.openai.com" },
          { value: "claude", label: "Claude", hint: "via OpenRouter-compatible endpoint" },
          { value: "gemini", label: "Gemini", hint: "via Gemini OpenAI compatibility endpoint" },
          { value: "grok", label: "Grok", hint: "xAI endpoint" },
          { value: "custom", label: "Custom", hint: "any OpenAI-compatible provider" },
        ],
        initialValue: "openai" as "openai" | "claude" | "gemini" | "grok" | "custom",
      }))) as "openai" | "claude" | "gemini" | "grok" | "custom";

      if (llmPreset === "openai") {
        openaiModel = "gpt-4o";
        openaiBaseUrl = "";
      } else if (llmPreset === "claude") {
        openaiModel = "anthropic/claude-3.5-sonnet";
        openaiBaseUrl = "https://openrouter.ai/api/v1";
      } else if (llmPreset === "gemini") {
        openaiModel = "gemini-1.5-pro";
        openaiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
      } else if (llmPreset === "grok") {
        openaiModel = "grok-2-latest";
        openaiBaseUrl = "https://api.x.ai/v1";
      }

      openaiModel = (await prompt(text({
        message: "Model ID:",
        placeholder: openaiModel,
        initialValue: openaiModel,
        validate: (v) => (!v ? "Model ID required" : undefined),
      }))) as string;

      openaiBaseUrl = (await prompt(text({
        message: "Base URL (blank for OpenAI default):",
        placeholder: "https://api.openai.com/v1",
        initialValue: openaiBaseUrl,
      }))) as string;
    }

    speech = (await prompt(select({
      message: "Speech transcription provider:",
      options: [
        { value: "none", label: "none", hint: "recordings save as media evidence without transcription" },
        { value: "azure", label: "azure (Azure Speech)", hint: "recommended for Azure-integrated deployments" },
        { value: "openai", label: "openai-compatible", hint: "choose any transcription model/endpoint" },
      ],
      initialValue: "none" as "none" | "azure" | "openai",
    }))) as "none" | "azure" | "openai";

    if (speech === "openai") {
      openaiTranscriptionModel = (await prompt(text({
        message: "Transcription model ID:",
        placeholder: openaiTranscriptionModel,
        initialValue: openaiTranscriptionModel,
        validate: (v) => (!v ? "Transcription model ID required" : undefined),
      }))) as string;

      openaiTranscriptionBaseUrl = (await prompt(text({
        message: "Transcription base URL (blank for OpenAI default):",
        placeholder: "https://api.openai.com/v1",
        initialValue: openaiTranscriptionBaseUrl,
      }))) as string;
    }

    storage = (await prompt(select({
      message: "Storage provider:",
      options: [
        { value: "local", label: "local (filesystem JSON)", hint: "no Cosmos required" },
        { value: "azure", label: "azure (Cosmos DB)" },
      ],
      initialValue: "azure" as "local" | "azure",
    }))) as "local" | "azure";

    auth = (await prompt(select({
      message: "Auth provider:",
      options: [
        { value: "none", label: "none (open)", hint: "local dev" },
        { value: "azure", label: "azure (Entra ID)" },
      ],
      initialValue: "none" as "none" | "azure",
    }))) as "none" | "azure";

    const setupBackupFolder = await prompt(confirm({
      message: "Set up a local backup storage folder (recommended)?",
      initialValue: true,
    }));

    if (setupBackupFolder) {
      localDataPath = await prompt(text({
        message: "Local backup storage folder path:",
        placeholder: "./data",
        initialValue: "./data",
        validate: (v) => (!v ? "Path required" : undefined),
      }));

      const resolvedLocalDataPath = isAbsolute(localDataPath)
        ? localDataPath
        : resolve(target, localDataPath);
      const confirmBackupFolderPath = await prompt(confirm({
        message: `Use local backup storage folder ${pc.bold(resolvedLocalDataPath)}?`,
        initialValue: true,
      }));
      if (!confirmBackupFolderPath) {
        cancel("Aborted.");
        process.exit(0);
      }

      createLocalDataFolder = true;
    } else {
      createLocalDataFolder = false;
    }
  }

  if (setupMode === "local-only") {
    localDataPath = await prompt(text({
      message: "Local storage folder path:",
      placeholder: "./data",
      initialValue: "./data",
      validate: (v) => (!v ? "Path required" : undefined),
    }));

    const resolvedLocalDataPath = isAbsolute(localDataPath)
      ? localDataPath
      : resolve(target, localDataPath);
    const confirmLocalDataPath = await prompt(confirm({
      message: `Use local storage folder ${pc.bold(resolvedLocalDataPath)}?`,
      initialValue: true,
    }));
    if (!confirmLocalDataPath) {
      cancel("Aborted.");
      process.exit(0);
    }
    createLocalDataFolder = true;
  }

  const version = await prompt(text({
    message: "Pin to framework version:",
    placeholder: LATEST_VERSION,
    initialValue: LATEST_VERSION,
    validate: validateFrameworkVersion,
  }));

  const initialProject = await prompt(text({
    message: "Initial project slug (optional, blank to skip):",
    placeholder: "discovery-1",
    initialValue: "",
  }));

  let contentSource: "local" | "engagement-repo" | "custom" = "local";
  let projectsSource = "./projects";
  let createProjectsSourceFolder = false;

  if (setupMode === "local-only") {
    const createFolder = await prompt(confirm({
      message: "Create a local content folder now for this instance?",
      initialValue: true,
    }));

    if (createFolder) {
      projectsSource = await prompt(text({
        message: "Local content folder path (mounted as /data/projects):",
        placeholder: "./projects",
        initialValue: "./projects",
        validate: (v) => (!v ? "Path required" : undefined),
      }));

      const resolvedProjectsSource = isAbsolute(projectsSource)
        ? projectsSource
        : resolve(target, projectsSource);
      const confirmFolderPath = await prompt(confirm({
        message: `Create local content folder at ${pc.bold(resolvedProjectsSource)}?`,
        initialValue: true,
      }));
      if (!confirmFolderPath) {
        cancel("Aborted.");
        process.exit(0);
      }

      createProjectsSourceFolder = true;
      contentSource = projectsSource === "./projects" ? "local" : "custom";
    } else {
      contentSource = "local";
      projectsSource = "./projects";
    }
  } else {
    contentSource = (await prompt(select({
      message: "Where will this customer's content live?",
      options: [
        { value: "local", label: "local folder in this repo (./projects)", hint: "default — drop markdown right here" },
        { value: "engagement-repo", label: "engagement-repo repo (sibling clone of org/<customer>)", hint: "git-backed shared notes" },
        { value: "custom", label: "custom host path (any folder of markdown)" },
      ],
      initialValue: "local" as "local" | "engagement-repo" | "custom",
    }))) as "local" | "engagement-repo" | "custom";

    if (contentSource === "engagement-repo") {
      const engagementRepoDefault = `../${name}-content`;
      projectsSource = (await prompt(text({
        message: "Host path to engagement-repo clone (mounted as /data/projects):",
        placeholder: engagementRepoDefault,
        initialValue: engagementRepoDefault,
        validate: (v) => (!v ? "Path required" : undefined),
      }))) as string;
    } else if (contentSource === "custom") {
      projectsSource = (await prompt(text({
        message: "Host path to mount as /data/projects (absolute or relative to this repo):",
        placeholder: "../my-customer-content",
        validate: (v) => (!v ? "Path required" : undefined),
      }))) as string;
    }
  }

  const proceed = await prompt(confirm({
    message: `Create ${pc.bold("./" + name)} pinned to v${version}?`,
    initialValue: true,
  }));
  if (!proceed) {
    cancel("Aborted.");
    process.exit(0);
  }

  const s = spinner();
  s.start("Scaffolding…");
  try {
    await scaffold({
      target,
      name,
      displayName: displayName as string,
      version: version as string,
      llm, storage, auth,
      openaiModel,
      openaiBaseUrl,
      speech,
      openaiTranscriptionModel,
      openaiTranscriptionBaseUrl,
      initialProject: (initialProject as string).trim() || undefined,
      contentSource,
      projectsSource,
      createProjectsSourceFolder,
      localDataPath,
      createLocalDataFolder,
    });
    s.stop("Scaffolded ✔");
  } catch (err) {
    s.stop("Failed");
    cancel(String(err));
    process.exit(1);
  }

  const nextSteps = [
    `${pc.bold("cd")} ${name}`,
  ];
  if (contentSource === "engagement-repo") {
    // The PROJECTS_SOURCE path was just captured into .env. The
    // engagement-repo clone has to live there relative to the
    // scaffolded customer directory for the compose mount to resolve.
    const cloneTarget = projectsSource;
    nextSteps.push(
      pc.dim(`# clone the engagement-repo at the path PROJECTS_SOURCE points to:`),
      `${pc.bold(`git clone https://github.com/<org>/${name}.git ${cloneTarget}`)}`,
    );
  }
  nextSteps.push(
    `${pc.bold("docker compose pull")}`,
    `${pc.bold("docker compose up -d")}`,
    `${pc.bold("open")} http://localhost:3000  ${pc.dim("# or: start http://localhost:3000 on Windows")}`,
  );
  note(nextSteps.join("\n"), "Next steps");
  outro(pc.green("Done."));
}

async function prompt<T>(p: Promise<T | symbol>): Promise<T> {
  const v = await p;
  if (isCancel(v)) {
    cancel("Aborted.");
    process.exit(0);
  }
  return v as T;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
