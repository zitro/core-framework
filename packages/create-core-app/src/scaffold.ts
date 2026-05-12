import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { atomicWrite } from "./atomic.js";
import { writeMarker, type CoreDiscoveryMarker } from "./marker.js";
import {
  composeYaml,
  envExample,
  gitignore,
  readme,
  renovateJson,
  infraReadme,
  extensionsReadme,
} from "./templates.js";
import { CLI_VERSION } from "./version.js";

export interface ScaffoldOptions {
  target: string;
  name: string;
  displayName: string;
  version: string;
  llm: "local" | "azure" | "openai";
  openaiModel: string;
  openaiBaseUrl?: string;
  speech: "none" | "azure" | "openai";
  openaiTranscriptionModel: string;
  openaiTranscriptionBaseUrl?: string;
  storage: "local" | "azure";
  auth: "none" | "azure";
  initialProject?: string;
  // Resolved Azure resource values. Populated by the Azure setup wizard
  // when the corresponding provider is "azure"; empty otherwise. The
  // env template lets blanks fall through, so callers can leave them
  // unset for local-only scaffolds.
  azureOpenAIEndpoint?: string;
  azureOpenAIKey?: string;
  azureOpenAIDeployment?: string;
  cosmosEndpoint?: string;
  cosmosKey?: string;
  cosmosDatabase?: string;
  azureSpeechKey?: string;
  azureSpeechRegion?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
}

/** Write the customer-repo scaffold to disk. */
export async function scaffold(o: ScaffoldOptions): Promise<void> {
  // data/* and projects/ always live inside the customer repo. compose.yaml
  // mounts ./data and ./projects with relative paths so they resolve against
  // the compose file's location — bind mounts never drift to the shell's cwd.
  const dirs = [
    "",
    "projects",
    "extensions",
    "config/prompts",
    "infra",
    "data/customers",
    "data/engagements",
    "data/discoveries",
  ];
  if (o.initialProject) dirs.push(`projects/${o.initialProject}`);

  for (const d of dirs) {
    await mkdir(join(o.target, d), { recursive: true });
  }

  // Files the CLI is responsible for under upgrade mode. .env is
  // INTENTIONALLY EXCLUDED — it holds the user's secrets and must
  // never be overwritten by a framework upgrade. .env.example is
  // included because it's framework-template and safe to refresh;
  // the user manually diffs it against their .env when new fields
  // appear.
  //
  // Order matters only for the marker — that's written LAST via
  // writeMarker so a crash mid-scaffold leaves the dir markerless
  // (and therefore unupgradeable until rescaffolded), rather than
  // half-upgradeable.
  const managed: Array<{ rel: string; content: string }> = [
    { rel: "compose.yaml", content: composeYaml(o) },
    { rel: ".gitignore", content: gitignore() },
    { rel: "README.md", content: readme(o) },
    { rel: "renovate.json", content: renovateJson() },
    { rel: "infra/README.md", content: infraReadme(o) },
    { rel: "extensions/README.md", content: extensionsReadme() },
  ];

  for (const { rel, content } of managed) {
    await atomicWrite(join(o.target, rel), content);
  }

  // .env and .env.example are seeded from the same template but
  // INTENTIONALLY NOT tracked in files_managed:
  //   - .env: holds the user's secrets; must never be overwritten
  //     by upgrade.
  //   - .env.example: depends on every provider knob (llm, storage,
  //     auth, speech, openai*, azure*) which the marker doesn't
  //     store. Re-rendering against marker-only context would
  //     produce false-positive diffs for any customer who
  //     customized providers. Users compare their .env against a
  //     fresh scaffold by hand when new fields ship.
  await atomicWrite(join(o.target, ".env"), envExample(o));
  await atomicWrite(join(o.target, ".env.example"), envExample(o));

  // .gitkeeps + initial project README aren't tracked in files_managed
  // (the upgrade flow shouldn't try to manage them).
  await Promise.all([
    write(o, "extensions/.gitkeep", ""),
    write(o, "projects/.gitkeep", ""),
    write(o, "config/prompts/.gitkeep", ""),
    o.initialProject
      ? write(o, `projects/${o.initialProject}/README.md`, projectReadme(o.initialProject))
      : Promise.resolve(),
  ]);

  // Seed records so the UI is non-empty on first boot. v1.3.1's backend
  // reads these JSONs directly from data/ on demand; no migration is
  // needed. Slugs match what the UI expects from POST /api/engagements.
  const customerId = randomUUID();
  const customerSeed = {
    slug: o.name,
    display_name: o.displayName,
    industry: "",
    summary: "",
    sources: [],
    id: customerId,
  };
  await atomicWrite(
    join(o.target, `data/customers/${customerId}.json`),
    JSON.stringify(customerSeed, null, 2) + "\n",
  );

  if (o.initialProject) {
    const projectSlug = slugify(o.initialProject);
    const projectMeta = {
      schema_version: "1.0.0",
      slug: projectSlug,
      name: o.initialProject,
      description: "",
      tags: [],
    };
    await atomicWrite(
      join(o.target, `projects/${o.initialProject}/project.json`),
      JSON.stringify(projectMeta, null, 2) + "\n",
    );

    const engagementId = randomUUID();
    const now = new Date().toISOString();
    const engagementSeed = {
      id: engagementId,
      slug: projectSlug,
      name: o.initialProject,
      customer: o.displayName,
      industry: "",
      summary: "",
      status: "proposed",
      repo_path: "",
      discovery_ids: [],
      owners: [],
      tags: [],
      created_by: "",
      updated_by: "",
      created_at: now,
      updated_at: now,
    };
    await atomicWrite(
      join(o.target, `data/engagements/${engagementId}.json`),
      JSON.stringify(engagementSeed, null, 2) + "\n",
    );
  }

  // Marker LAST so a crash anywhere above leaves no marker — next CLI
  // run will refuse to upgrade and the user can rescaffold cleanly.
  const marker: CoreDiscoveryMarker = {
    schema_version: "1.0.0",
    customer_slug: o.name,
    display_name: o.displayName,
    cli_version_created: CLI_VERSION,
    cli_version_last_upgrade: null,
    framework_version_pinned: o.version,
    created_at: new Date().toISOString(),
    last_upgrade_at: null,
    files_managed: managed.map((f) => f.rel),
  };
  await writeMarker(o.target, marker);
}

async function write(o: ScaffoldOptions, rel: string, content: string): Promise<void> {
  await writeFile(join(o.target, rel), content, "utf8");
}

function projectReadme(slug: string): string {
  return [
    `# ${slug}`,
    "",
    "Drop project source markdown into this folder. The scaffolder already",
    "seeded the matching engagement record in `data/engagements/`, so this",
    "project shows up in the UI as soon as you start the stack.",
    "",
  ].join("\n");
}

/** URL-safe slug from a free-text project name. Lowercase + hyphens; collapses
 *  runs; strips leading/trailing hyphens. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
