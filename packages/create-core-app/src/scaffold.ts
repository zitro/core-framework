import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

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
  contentSource: "local" | "engagement-repo" | "custom";
  projectsSource: string;
  createProjectsSourceFolder?: boolean;
  localDataPath: string;
  createLocalDataFolder?: boolean;
}

/** Write the customer-repo scaffold to disk. */
export async function scaffold(o: ScaffoldOptions): Promise<void> {
  const dirs = [
    "",
    "projects",
    "extensions",
    "config/prompts",
    "infra",
  ];
  if (o.initialProject) dirs.push(`projects/${o.initialProject}`);

  for (const d of dirs) {
    await mkdir(join(o.target, d), { recursive: true });
  }

  if (o.createProjectsSourceFolder) {
    const projectsPath = isAbsolute(o.projectsSource)
      ? o.projectsSource
      : resolve(o.target, o.projectsSource);
    await mkdir(projectsPath, { recursive: true });
  }

  if (o.createLocalDataFolder) {
    const dataPath = isAbsolute(o.localDataPath)
      ? o.localDataPath
      : resolve(o.target, o.localDataPath);
    await mkdir(dataPath, { recursive: true });
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
    { rel: ".env.example", content: envExample(o) },
    { rel: ".gitignore", content: gitignore() },
    { rel: "README.md", content: readme(o) },
    { rel: "renovate.json", content: renovateJson() },
    { rel: "infra/README.md", content: infraReadme(o) },
    { rel: "extensions/README.md", content: extensionsReadme() },
  ];

  for (const { rel, content } of managed) {
    await atomicWrite(join(o.target, rel), content);
  }

  // Write .env separately so it's seeded from the same template as
  // .env.example but stays untracked by files_managed.
  await atomicWrite(join(o.target, ".env"), envExample(o));

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
    "Drop project source markdown here. Register it with the running backend so it appears in the UI:",
    "",
    "```powershell",
    `$body = @{ name = "${slug}"; slug = "${slug}"; repo_path = "${slug}" } | ConvertTo-Json`,
    "Invoke-RestMethod -Uri http://localhost:8000/api/projects -Method Post `",
    "  -ContentType \"application/json\" -Body $body",
    "```",
    "",
  ].join("\n");
}
