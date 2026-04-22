import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  composeYaml,
  envExample,
  gitignore,
  readme,
  renovateJson,
  infraReadme,
  extensionsReadme,
} from "./templates.js";

export interface ScaffoldOptions {
  target: string;
  name: string;
  displayName: string;
  version: string;
  llm: "local" | "azure" | "openai";
  storage: "local" | "azure";
  auth: "none" | "azure";
  initialProject?: string;
  contentSource: "local" | "vertex" | "custom";
  projectsSource: string;
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

  await Promise.all([
    write(o, "compose.yaml", composeYaml(o)),
    write(o, ".env.example", envExample(o)),
    write(o, ".env", envExample(o)),
    write(o, ".gitignore", gitignore()),
    write(o, "README.md", readme(o)),
    write(o, "renovate.json", renovateJson()),
    write(o, "infra/README.md", infraReadme(o)),
    write(o, "extensions/README.md", extensionsReadme()),
    write(o, "extensions/.gitkeep", ""),
    write(o, "projects/.gitkeep", ""),
    write(o, "config/prompts/.gitkeep", ""),
    o.initialProject
      ? write(o, `projects/${o.initialProject}/README.md`, projectReadme(o.initialProject))
      : Promise.resolve(),
  ]);
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
