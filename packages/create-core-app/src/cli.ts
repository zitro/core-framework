#!/usr/bin/env node
import { intro, outro, text, select, confirm, isCancel, cancel, spinner, note } from "@clack/prompts";
import pc from "picocolors";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { scaffold } from "./scaffold.js";
import { LATEST_VERSION } from "./version.js";

async function main(): Promise<void> {
  intro(pc.cyan("◆ create-core-discovery-app"));

  const argName = process.argv[2]?.trim();
  const name = argName ?? (await prompt(text({
    message: "Customer name (also the directory name):",
    placeholder: "acme",
    validate: (v) => (!v ? "Name required" : !/^[a-z0-9][a-z0-9-]*$/.test(v) ? "Lowercase alnum + hyphens only" : undefined),
  })));

  const target = resolve(process.cwd(), name);
  if (existsSync(target)) {
    cancel(`Directory ${pc.bold(name)} already exists. Aborting.`);
    process.exit(1);
  }

  const displayName = await prompt(text({
    message: "Display name (shown in UI / README):",
    placeholder: name.charAt(0).toUpperCase() + name.slice(1),
    initialValue: name.charAt(0).toUpperCase() + name.slice(1),
  }));

  const llm = (await prompt(select({
    message: "LLM provider:",
    options: [
      { value: "local", label: "local (Ollama / dev)", hint: "no Azure required" },
      { value: "azure", label: "azure (Azure OpenAI)" },
      { value: "openai", label: "openai (OpenAI direct)" },
    ],
    initialValue: "local" as "local" | "azure" | "openai",
  }))) as "local" | "azure" | "openai";

  const storage = (await prompt(select({
    message: "Storage provider:",
    options: [
      { value: "local", label: "local (filesystem JSON)", hint: "no Cosmos required" },
      { value: "azure", label: "azure (Cosmos DB)" },
    ],
    initialValue: "local" as "local" | "azure",
  }))) as "local" | "azure";

  const auth = (await prompt(select({
    message: "Auth provider:",
    options: [
      { value: "none", label: "none (open)", hint: "local dev" },
      { value: "azure", label: "azure (Entra ID)" },
    ],
    initialValue: "none" as "none" | "azure",
  }))) as "none" | "azure";

  const version = await prompt(text({
    message: "Pin to framework version:",
    placeholder: LATEST_VERSION,
    initialValue: LATEST_VERSION,
  }));

  const initialProject = await prompt(text({
    message: "Initial project slug (optional, blank to skip):",
    placeholder: "discovery-1",
    initialValue: "",
  }));

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
      initialProject: (initialProject as string).trim() || undefined,
    });
    s.stop("Scaffolded ✔");
  } catch (err) {
    s.stop("Failed");
    cancel(String(err));
    process.exit(1);
  }

  note(
    [
      `${pc.bold("cd")} ${name}`,
      `${pc.bold("docker compose pull")}`,
      `${pc.bold("docker compose up -d")}`,
      `${pc.bold("start")} http://localhost:3000`,
    ].join("\n"),
    "Next steps",
  );
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
