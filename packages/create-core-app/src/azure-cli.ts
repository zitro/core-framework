// Thin wrapper around the Azure CLI (`az`) for auto-discovering resources
// during customer-repo scaffolding. Every helper here is best-effort:
// returns null on any failure (missing binary, not logged in, no perms),
// caller falls back to manual paste prompts. We intentionally never
// throw — Azure CLI behavior varies enough across versions and tenants
// that any failure path should be recoverable, not fatal.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Use the platform-specific shim path so we never invoke a shell. The
// .cmd extension on Windows is required because Node's execFile does
// not auto-resolve it the way the user's shell does.
const AZ_BIN = process.platform === "win32" ? "az.cmd" : "az";

export interface AzAccount {
  user: { name: string };
  tenantId: string;
  id: string;
  name: string;
}

export interface AzSubscription {
  id: string;
  name: string;
  tenantId: string;
  isDefault: boolean;
}

export interface AzResourceRef {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  kind?: string;
}

export interface AzOpenAIDeployment {
  name: string;
  model: string;
}

export interface AzEntraApp {
  appId: string;
  displayName: string;
  signInAudience: string;
}

async function azJson<T>(args: string[]): Promise<T | null> {
  const result = await azRaw(args);
  if (!result) return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    return null;
  }
}

async function azRaw(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(AZ_BIN, args, {
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

/** True if `az --version` exits cleanly. */
export async function azInstalled(): Promise<boolean> {
  return (await azRaw(["--version"])) !== null;
}

/** Account info if signed in, else null. */
export async function azWhoAmI(): Promise<AzAccount | null> {
  return azJson<AzAccount>(["account", "show", "--output", "json"]);
}

export async function azListSubscriptions(): Promise<AzSubscription[]> {
  return (await azJson<AzSubscription[]>(["account", "list", "--output", "json"])) ?? [];
}

export async function azSetSubscription(id: string): Promise<boolean> {
  return (await azRaw(["account", "set", "--subscription", id])) !== null;
}

interface CognitiveAccount {
  id: string;
  name: string;
  location: string;
  kind: string;
  resourceGroup?: string;
}

async function listCognitiveAccountsOfKind(kind: string): Promise<AzResourceRef[]> {
  const all = await azJson<CognitiveAccount[]>([
    "cognitiveservices",
    "account",
    "list",
    "--output",
    "json",
  ]);
  if (!all) return [];
  return all
    .filter((a) => a.kind === kind)
    .map((a) => ({
      id: a.id,
      name: a.name,
      location: a.location,
      kind: a.kind,
      resourceGroup: a.resourceGroup ?? extractResourceGroup(a.id),
    }));
}

export function azListOpenAIAccounts(): Promise<AzResourceRef[]> {
  return listCognitiveAccountsOfKind("OpenAI");
}

export function azListSpeechAccounts(): Promise<AzResourceRef[]> {
  return listCognitiveAccountsOfKind("SpeechServices");
}

export async function azListOpenAIDeployments(
  accountName: string,
  resourceGroup: string,
): Promise<AzOpenAIDeployment[]> {
  const raw = await azJson<Array<{ name: string; properties?: { model?: { name?: string } } }>>([
    "cognitiveservices",
    "account",
    "deployment",
    "list",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--output",
    "json",
  ]);
  if (!raw) return [];
  return raw.map((d) => ({
    name: d.name,
    model: d.properties?.model?.name ?? "",
  }));
}

export async function azGetOpenAIEndpoint(
  accountName: string,
  resourceGroup: string,
): Promise<string | null> {
  const raw = await azJson<{ properties?: { endpoint?: string } }>([
    "cognitiveservices",
    "account",
    "show",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--output",
    "json",
  ]);
  return raw?.properties?.endpoint ?? null;
}

export async function azGetOpenAIKey(
  accountName: string,
  resourceGroup: string,
): Promise<string | null> {
  const raw = await azJson<{ key1?: string }>([
    "cognitiveservices",
    "account",
    "keys",
    "list",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--output",
    "json",
  ]);
  return raw?.key1 ?? null;
}

export async function azGetSpeechKey(
  accountName: string,
  resourceGroup: string,
): Promise<{ key: string; region: string } | null> {
  const account = await azJson<{ location?: string }>([
    "cognitiveservices",
    "account",
    "show",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--output",
    "json",
  ]);
  const keys = await azJson<{ key1?: string }>([
    "cognitiveservices",
    "account",
    "keys",
    "list",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--output",
    "json",
  ]);
  if (!account || !keys?.key1) return null;
  return { key: keys.key1, region: account.location ?? "" };
}

export async function azListCosmosAccounts(): Promise<AzResourceRef[]> {
  const all = await azJson<Array<{
    id: string;
    name: string;
    location: string;
    resourceGroup?: string;
  }>>(["cosmosdb", "list", "--output", "json"]);
  if (!all) return [];
  return all.map((a) => ({
    id: a.id,
    name: a.name,
    location: a.location,
    resourceGroup: a.resourceGroup ?? extractResourceGroup(a.id),
  }));
}

export async function azGetCosmosEndpoint(
  accountName: string,
  resourceGroup: string,
): Promise<string | null> {
  const raw = await azJson<{ documentEndpoint?: string }>([
    "cosmosdb",
    "show",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--output",
    "json",
  ]);
  return raw?.documentEndpoint ?? null;
}

export async function azGetCosmosKey(
  accountName: string,
  resourceGroup: string,
): Promise<string | null> {
  const raw = await azJson<{ primaryMasterKey?: string }>([
    "cosmosdb",
    "keys",
    "list",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--output",
    "json",
  ]);
  return raw?.primaryMasterKey ?? null;
}

/** All Entra application registrations the signed-in user owns. */
export async function azListEntraApps(): Promise<AzEntraApp[]> {
  return (
    (await azJson<AzEntraApp[]>([
      "ad",
      "app",
      "list",
      "--show-mine",
      "--output",
      "json",
    ])) ?? []
  );
}

/** Reset (or create) a client secret for an Entra app and return it.
 *  The secret value is returned only once — caller must persist immediately. */
export async function azResetEntraAppSecret(
  appId: string,
  displayName = "core-discovery-cli",
): Promise<string | null> {
  const raw = await azJson<{ password?: string }>([
    "ad",
    "app",
    "credential",
    "reset",
    "--id",
    appId,
    "--display-name",
    displayName,
    "--years",
    "2",
    "--output",
    "json",
  ]);
  return raw?.password ?? null;
}

function extractResourceGroup(resourceId: string): string {
  const match = /\/resourceGroups\/([^/]+)\//i.exec(resourceId);
  return match ? match[1] : "";
}
