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

/**
 * In-place upgrade flow: invoked when the CLI is run from inside an
 * existing customer repo (a `core-discovery.json` marker in the cwd
 * and no customer-name arg). Mirrors the named-dir upgrade UX but
 * skips the name prompt and operates on `cwd` directly.
 */
async function runUpgradeAtCwd(
  cwd: string,
  marker: Awaited<ReturnType<typeof readMarker>>,
): Promise<number> {
  if (marker === null) return 1;

  const proceed = await prompt(confirm({
    message: `Upgrade this CORE Discovery repo (last touched by CLI ${marker.cli_version_last_upgrade ?? marker.cli_version_created})?`,
    initialValue: true,
  }));
  if (!proceed) {
    cancel("Aborted.");
    return 0;
  }

  const s = spinner();
  let spinnerActive = true;
  s.start("Planning upgrade…");
  let result!: UpgradeResult;
  try {
    result = await runUpgradeMode({
      repoPath: cwd,
      confirm: async (preview) => {
        s.stop("Plan ready.");
        spinnerActive = false;
        note(preview, "Pending changes");
        return await prompt(confirm({
          message: "Apply these changes?",
          initialValue: true,
        }));
      },
      onBeforeCommit: () => {
        s.start("Applying changes…");
        spinnerActive = true;
      },
    });
  } catch (err) {
    if (spinnerActive) s.stop("Failed");
    cancel(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (spinnerActive) {
    s.stop(
      result.applied.length === 0
        ? "No changes needed."
        : `Applied ${result.applied.length} file(s).`,
    );
  }
  if (result.warnings.length > 0) note(result.warnings.join("\n"), "Warnings");
  if (result.aborted) {
    cancel("Upgrade aborted.");
    return 0;
  }
  if (result.applied.length === 0) {
    outro(pc.green("Already up to date."));
    return 0;
  }
  note(
    result.applied.map((p) => `- ${p}`).join("\n"),
    `Updated ${result.applied.length} file(s)`,
  );
  outro(pc.green("Upgrade complete."));
  return 0;
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

  // In-place upgrade detection: if the user runs the CLI from inside
  // an existing customer repo (a core-discovery.json marker in the
  // cwd) and doesn't pass a customer name, treat that as "upgrade me"
  // instead of prompting for a fresh scaffold.
  if (argName === undefined) {
    const cwd = process.cwd();
    const cwdMarker = await readMarker(cwd);
    if (cwdMarker !== null) {
      const code = await runUpgradeAtCwd(cwd, cwdMarker);
      process.exit(code);
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

  // Display name is just the title-cased slug — no prompt for it.
  // Folders (./data, ./projects) always live inside this customer repo,
  // resolved relative to compose.yaml at runtime. Both are created
  // unconditionally during scaffold. Framework version pins silently
  // to LATEST_VERSION.
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  const version = LATEST_VERSION;

  const setupMode = (await prompt(select({
    message: "Setup mode:",
    options: [
      {
        value: "local-only",
        label: "Local-only",
        hint: "no Azure/external services — recommended for quick start",
      },
      {
        value: "service-integrated",
        label: "Service-integrated",
        hint: "configure AI / storage / auth providers (Azure or OpenAI-compatible)",
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

  let azureOpenAIEndpoint = "";
  let azureOpenAIKey = "";
  let azureOpenAIDeployment = "";
  let cosmosEndpoint = "";
  let cosmosKey = "";
  let cosmosDatabase = "";
  let azureSpeechKey = "";
  let azureSpeechRegion = "";
  let azureTenantId = "";
  let azureClientId = "";
  let azureClientSecret = "";

  if (setupMode === "service-integrated") {
    llm = (await prompt(select({
      message: "AI provider:",
      options: [
        { value: "azure", label: "Azure OpenAI" },
        { value: "openai", label: "OpenAI-compatible", hint: "OpenAI / Claude / Gemini / Grok / custom" },
        { value: "local", label: "local", hint: "Ollama for dev" },
      ],
      initialValue: "azure" as "local" | "azure" | "openai",
    }))) as "local" | "azure" | "openai";

    if (llm === "openai") {
      const llmPreset = (await prompt(select({
        message: "Model family:",
        options: [
          { value: "openai", label: "OpenAI", hint: "api.openai.com" },
          { value: "claude", label: "Claude", hint: "via OpenRouter" },
          { value: "gemini", label: "Gemini", hint: "Gemini OpenAI-compat endpoint" },
          { value: "grok", label: "Grok", hint: "xAI endpoint" },
          { value: "custom", label: "Custom", hint: "any OpenAI-compatible endpoint" },
        ],
        initialValue: "openai" as "openai" | "claude" | "gemini" | "grok" | "custom",
      }))) as "openai" | "claude" | "gemini" | "grok" | "custom";

      if (llmPreset === "openai") { openaiModel = "gpt-4o"; openaiBaseUrl = ""; }
      else if (llmPreset === "claude") { openaiModel = "anthropic/claude-3.5-sonnet"; openaiBaseUrl = "https://openrouter.ai/api/v1"; }
      else if (llmPreset === "gemini") { openaiModel = "gemini-1.5-pro"; openaiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai"; }
      else if (llmPreset === "grok") { openaiModel = "grok-2-latest"; openaiBaseUrl = "https://api.x.ai/v1"; }
      else {
        openaiModel = (await prompt(text({
          message: "Model ID:",
          placeholder: "gpt-4o",
          initialValue: "gpt-4o",
          validate: (v) => (!v ? "Model ID required" : undefined),
        }))) as string;
        openaiBaseUrl = (await prompt(text({
          message: "Base URL:",
          placeholder: "https://api.openai.com/v1",
          initialValue: "",
        }))) as string;
      }
    }

    storage = (await prompt(select({
      message: "Storage provider:",
      options: [
        { value: "azure", label: "Azure Cosmos DB" },
        { value: "local", label: "local filesystem", hint: "no Cosmos required" },
      ],
      initialValue: "azure" as "local" | "azure",
    }))) as "local" | "azure";

    auth = (await prompt(select({
      message: "Auth provider:",
      options: [
        { value: "azure", label: "Microsoft Entra ID" },
        { value: "none", label: "none (open)", hint: "local dev" },
      ],
      initialValue: "azure" as "none" | "azure",
    }))) as "none" | "azure";

    speech = (await prompt(select({
      message: "Speech transcription:",
      options: [
        { value: "azure", label: "Azure Speech" },
        { value: "openai", label: "OpenAI-compatible", hint: "Whisper / gpt-4o-transcribe / custom" },
        { value: "none", label: "none", hint: "recordings save as media without transcription" },
      ],
      initialValue: "azure" as "none" | "azure" | "openai",
    }))) as "none" | "azure" | "openai";

    if (speech === "openai") {
      const speechPreset = (await prompt(select({
        message: "Transcription model:",
        options: [
          { value: "openai", label: "OpenAI default", hint: "gpt-4o-transcribe via api.openai.com" },
          { value: "custom", label: "Custom", hint: "any OpenAI-compatible transcription endpoint" },
        ],
        initialValue: "openai" as "openai" | "custom",
      }))) as "openai" | "custom";

      if (speechPreset === "openai") { openaiTranscriptionModel = "gpt-4o-transcribe"; openaiTranscriptionBaseUrl = ""; }
      else {
        openaiTranscriptionModel = (await prompt(text({
          message: "Transcription model ID:",
          placeholder: "whisper-1",
          initialValue: "gpt-4o-transcribe",
          validate: (v) => (!v ? "Model ID required" : undefined),
        }))) as string;
        openaiTranscriptionBaseUrl = (await prompt(text({
          message: "Transcription base URL:",
          placeholder: "https://api.openai.com/v1",
          initialValue: "",
        }))) as string;
      }
    }

    // Azure auto-discovery sub-flow runs once if any provider is azure.
    const needsAzure = llm === "azure" || storage === "azure" || auth === "azure" || speech === "azure";
    if (needsAzure) {
      const onCancel = (): never => {
        cancel("Aborted.");
        process.exit(0);
      };
      const { initAzureContext, gatherAzureOpenAI, gatherCosmos, gatherAzureSpeech, gatherEntra } =
        await import("./azure-setup.js");
      let azCtx = await initAzureContext(onCancel);

      if (llm === "azure") {
        const r = await gatherAzureOpenAI(azCtx, onCancel);
        azCtx = r.ctx;
        azureOpenAIEndpoint = r.config.endpoint;
        azureOpenAIKey = r.config.apiKey;
        azureOpenAIDeployment = r.config.deployment;
      }
      if (storage === "azure") {
        const r = await gatherCosmos(azCtx, onCancel);
        azCtx = r.ctx;
        cosmosEndpoint = r.config.endpoint;
        cosmosKey = r.config.apiKey;
        cosmosDatabase = r.config.database;
      }
      if (speech === "azure") {
        const r = await gatherAzureSpeech(azCtx, onCancel);
        azCtx = r.ctx;
        azureSpeechKey = r.config.apiKey;
        azureSpeechRegion = r.config.region;
      }
      if (auth === "azure") {
        const r = await gatherEntra(azCtx, onCancel);
        azCtx = r.ctx;
        azureTenantId = r.config.tenantId;
        azureClientId = r.config.clientId;
        azureClientSecret = r.config.clientSecret;
      }
    }
  }

  const initialProject = (await prompt(text({
    message: "Initial discovery slug (optional):",
    placeholder: "discovery-1",
    initialValue: "",
  }))) as string;

  note(
    [
      `${pc.dim("Customer:")} ${pc.bold(name)} (${displayName})`,
      `${pc.dim("Version:")}  v${version}`,
      `${pc.dim("LLM:")}      ${llm}`,
      `${pc.dim("Storage:")}  ${storage}`,
      `${pc.dim("Auth:")}     ${auth}`,
      `${pc.dim("Speech:")}   ${speech}`,
      `${pc.dim("Layout:")}   ./data + ./projects inside this repo`,
    ].join("\n"),
    "Review",
  );

  const proceed = await prompt(confirm({
    message: `Create ${pc.bold("./" + name)}?`,
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
      displayName,
      version,
      llm, storage, auth,
      openaiModel,
      openaiBaseUrl,
      speech,
      openaiTranscriptionModel,
      openaiTranscriptionBaseUrl,
      initialProject: initialProject.trim() || undefined,
      azureOpenAIEndpoint,
      azureOpenAIKey,
      azureOpenAIDeployment,
      cosmosEndpoint,
      cosmosKey,
      cosmosDatabase,
      azureSpeechKey,
      azureSpeechRegion,
      azureTenantId,
      azureClientId,
      azureClientSecret,
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
