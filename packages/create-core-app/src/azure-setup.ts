// Orchestrates the Azure-resource discovery flow during scaffold.
//
// Each `gather*` function returns the values needed to populate .env
// for a given Azure-backed provider. When `az` is installed and the
// user is signed in, we list resources and let them pick. Otherwise
// we drop into paste-prompt mode with portal hints. Either way the
// caller gets a flat object with the values; there is no other
// information leakage.
//
// State (the signed-in account, the subscription pick) is captured
// once and reused across multiple gathers so the user picks their
// subscription one time instead of once per Azure service.

import { confirm, isCancel, note, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";

import {
  azGetCosmosEndpoint,
  azGetCosmosKey,
  azGetOpenAIEndpoint,
  azGetOpenAIKey,
  azGetSpeechKey,
  azInstalled,
  azListCosmosAccounts,
  azListEntraApps,
  azListOpenAIAccounts,
  azListOpenAIDeployments,
  azListSpeechAccounts,
  azListSubscriptions,
  azResetEntraAppSecret,
  azSetSubscription,
  azWhoAmI,
  type AzAccount,
  type AzSubscription,
} from "./azure-cli.js";

export interface AzureContext {
  /** Whether auto-discovery is available for the rest of the session. */
  mode: "az" | "paste";
  /** Signed-in account, only set in `az` mode. */
  account?: AzAccount;
  /** Selected subscription, only set in `az` mode after subscription pick. */
  subscription?: AzSubscription;
}

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

export interface CosmosConfig {
  endpoint: string;
  apiKey: string;
  database: string;
}

export interface AzureSpeechConfig {
  apiKey: string;
  region: string;
}

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

async function ask<T>(p: Promise<T | symbol>, onCancel: () => never): Promise<T> {
  const v = await p;
  if (isCancel(v)) onCancel();
  return v as T;
}

/** Probe for `az` and offer to use it. Falls back to paste mode on any
 *  obstacle (not installed, not logged in, user declines). Call once at
 *  the start of Azure-aware scaffolding. */
export async function initAzureContext(onCancel: () => never): Promise<AzureContext> {
  const s = spinner();
  s.start("Looking for Azure CLI…");
  const installed = await azInstalled();
  if (!installed) {
    s.stop("Azure CLI not found.");
    note(
      [
        `${pc.dim("Manual mode")}: I'll prompt for each Azure value with portal hints.`,
        `Install ${pc.bold("az")} from aka.ms/installazcli to enable auto-discovery on your next run.`,
      ].join("\n"),
      "Azure",
    );
    return { mode: "paste" };
  }
  const account = await azWhoAmI();
  if (!account) {
    s.stop("Azure CLI found, but you're not signed in.");
    const proceed = await ask(
      confirm({
        message: `Sign in with ${pc.bold("az login")} in another terminal, then continue here?`,
        initialValue: true,
      }),
      onCancel,
    );
    if (!proceed) return { mode: "paste" };
    s.start("Re-checking sign-in…");
    const retried = await azWhoAmI();
    if (!retried) {
      s.stop("Still not signed in.");
      note("Falling back to manual paste mode.", "Azure");
      return { mode: "paste" };
    }
    s.stop(`Signed in as ${pc.bold(retried.user.name)}.`);
    return { mode: "az", account: retried };
  }
  s.stop(`Signed in as ${pc.bold(account.user.name)}.`);
  return { mode: "az", account };
}

async function pickSubscription(
  ctx: AzureContext,
  onCancel: () => never,
): Promise<AzureContext> {
  if (ctx.mode !== "az" || ctx.subscription) return ctx;
  const subs = await azListSubscriptions();
  if (subs.length === 0) return ctx;
  const def = subs.find((s) => s.isDefault) ?? subs[0];
  if (subs.length === 1) {
    await azSetSubscription(def.id);
    return { ...ctx, subscription: def };
  }
  const id = await ask(
    select({
      message: "Azure subscription:",
      options: subs.map((sub) => ({
        value: sub.id,
        label: sub.name,
        hint: sub.isDefault ? "default" : undefined,
      })),
      initialValue: def.id,
    }),
    onCancel,
  );
  const sub = subs.find((s) => s.id === id) ?? def;
  await azSetSubscription(sub.id);
  return { ...ctx, subscription: sub };
}

async function pasteAzureOpenAI(onCancel: () => never): Promise<AzureOpenAIConfig> {
  note(
    [
      `${pc.dim("Find these in")} ${pc.bold("portal.azure.com")} ${pc.dim("→ Azure OpenAI → your resource → Keys and Endpoint.")}`,
      `${pc.dim("Deployment name is in")} ${pc.bold("Azure OpenAI Studio → Deployments")}.`,
    ].join("\n"),
    "Azure OpenAI — paste values",
  );
  const endpoint = await ask(
    text({
      message: "Endpoint URL:",
      placeholder: "https://<your-resource>.openai.azure.com",
      validate: (v) => (v?.startsWith("https://") ? undefined : "Must be an https:// URL"),
    }),
    onCancel,
  );
  const apiKey = await ask(
    text({
      message: "API key:",
      placeholder: "32-character key",
      validate: (v) => (v ? undefined : "Key required"),
    }),
    onCancel,
  );
  const deployment = await ask(
    text({
      message: "Deployment name:",
      placeholder: "gpt-4o",
      initialValue: "gpt-4o",
      validate: (v) => (v ? undefined : "Deployment name required"),
    }),
    onCancel,
  );
  return { endpoint: endpoint as string, apiKey: apiKey as string, deployment: deployment as string };
}

export async function gatherAzureOpenAI(
  ctx: AzureContext,
  onCancel: () => never,
): Promise<{ config: AzureOpenAIConfig; ctx: AzureContext }> {
  if (ctx.mode !== "az") {
    return { config: await pasteAzureOpenAI(onCancel), ctx };
  }
  const nextCtx = await pickSubscription(ctx, onCancel);
  const s = spinner();
  s.start("Listing Azure OpenAI accounts…");
  const accounts = await azListOpenAIAccounts();
  s.stop(`Found ${accounts.length} Azure OpenAI account${accounts.length === 1 ? "" : "s"}.`);
  if (accounts.length === 0) {
    note("No Azure OpenAI accounts in this subscription. Falling back to paste.", "Azure OpenAI");
    return { config: await pasteAzureOpenAI(onCancel), ctx: nextCtx };
  }
  const pick = await ask(
    select({
      message: "Azure OpenAI account:",
      options: accounts.map((a) => ({
        value: `${a.name}|${a.resourceGroup}`,
        label: a.name,
        hint: `${a.location} · ${a.resourceGroup}`,
      })),
      initialValue: `${accounts[0].name}|${accounts[0].resourceGroup}`,
    }),
    onCancel,
  );
  const [accountName, resourceGroup] = (pick as unknown as string).split("|");

  s.start("Loading deployments + key…");
  const [deployments, endpoint, apiKey] = await Promise.all([
    azListOpenAIDeployments(accountName, resourceGroup),
    azGetOpenAIEndpoint(accountName, resourceGroup),
    azGetOpenAIKey(accountName, resourceGroup),
  ]);
  s.stop(`Found ${deployments.length} deployment${deployments.length === 1 ? "" : "s"}.`);

  let deployment = "";
  if (deployments.length === 0) {
    deployment = (await ask(
      text({
        message: "Deployment name (none auto-detected):",
        placeholder: "gpt-4o",
        initialValue: "gpt-4o",
        validate: (v) => (v ? undefined : "Deployment name required"),
      }),
      onCancel,
    )) as string;
  } else if (deployments.length === 1) {
    deployment = deployments[0].name;
  } else {
    deployment = (await ask(
      select({
        message: "Deployment:",
        options: deployments.map((d) => ({
          value: d.name,
          label: d.name,
          hint: d.model || undefined,
        })),
        initialValue: deployments[0].name,
      }),
      onCancel,
    )) as unknown as string;
  }

  if (!endpoint || !apiKey) {
    note("Couldn't fetch endpoint or key. Falling back to paste.", "Azure OpenAI");
    return { config: await pasteAzureOpenAI(onCancel), ctx: nextCtx };
  }
  return {
    config: { endpoint, apiKey, deployment },
    ctx: nextCtx,
  };
}

async function pasteCosmos(onCancel: () => never): Promise<CosmosConfig> {
  note(
    `${pc.dim("Find these in")} ${pc.bold("portal.azure.com")} ${pc.dim("→ Azure Cosmos DB → your account → Keys.")}`,
    "Cosmos DB — paste values",
  );
  const endpoint = await ask(
    text({
      message: "Endpoint URI:",
      placeholder: "https://<your-account>.documents.azure.com:443/",
      validate: (v) => (v?.startsWith("https://") ? undefined : "Must be an https:// URL"),
    }),
    onCancel,
  );
  const apiKey = await ask(
    text({
      message: "Primary key:",
      placeholder: "Cosmos primary key",
      validate: (v) => (v ? undefined : "Key required"),
    }),
    onCancel,
  );
  const database = await ask(
    text({
      message: "Database name:",
      placeholder: "core-discovery",
      initialValue: "core-discovery",
      validate: (v) => (v ? undefined : "Database name required"),
    }),
    onCancel,
  );
  return { endpoint: endpoint as string, apiKey: apiKey as string, database: database as string };
}

export async function gatherCosmos(
  ctx: AzureContext,
  onCancel: () => never,
): Promise<{ config: CosmosConfig; ctx: AzureContext }> {
  if (ctx.mode !== "az") {
    return { config: await pasteCosmos(onCancel), ctx };
  }
  const nextCtx = await pickSubscription(ctx, onCancel);
  const s = spinner();
  s.start("Listing Cosmos accounts…");
  const accounts = await azListCosmosAccounts();
  s.stop(`Found ${accounts.length} Cosmos account${accounts.length === 1 ? "" : "s"}.`);
  if (accounts.length === 0) {
    note("No Cosmos accounts in this subscription. Falling back to paste.", "Cosmos DB");
    return { config: await pasteCosmos(onCancel), ctx: nextCtx };
  }
  const pick = await ask(
    select({
      message: "Cosmos account:",
      options: accounts.map((a) => ({
        value: `${a.name}|${a.resourceGroup}`,
        label: a.name,
        hint: `${a.location} · ${a.resourceGroup}`,
      })),
      initialValue: `${accounts[0].name}|${accounts[0].resourceGroup}`,
    }),
    onCancel,
  );
  const [accountName, resourceGroup] = (pick as unknown as string).split("|");
  s.start("Loading endpoint + key…");
  const [endpoint, apiKey] = await Promise.all([
    azGetCosmosEndpoint(accountName, resourceGroup),
    azGetCosmosKey(accountName, resourceGroup),
  ]);
  s.stop("Done.");
  if (!endpoint || !apiKey) {
    note("Couldn't fetch endpoint or key. Falling back to paste.", "Cosmos DB");
    return { config: await pasteCosmos(onCancel), ctx: nextCtx };
  }
  const database = (await ask(
    text({
      message: "Database name:",
      placeholder: "core-discovery",
      initialValue: "core-discovery",
      validate: (v) => (v ? undefined : "Database name required"),
    }),
    onCancel,
  )) as string;
  return {
    config: { endpoint, apiKey, database },
    ctx: nextCtx,
  };
}

async function pasteAzureSpeech(onCancel: () => never): Promise<AzureSpeechConfig> {
  note(
    `${pc.dim("Find these in")} ${pc.bold("portal.azure.com")} ${pc.dim("→ Speech service → your resource → Keys and Endpoint.")}`,
    "Azure Speech — paste values",
  );
  const apiKey = await ask(
    text({
      message: "Key 1:",
      placeholder: "Speech service key",
      validate: (v) => (v ? undefined : "Key required"),
    }),
    onCancel,
  );
  const region = await ask(
    text({
      message: "Region:",
      placeholder: "eastus",
      initialValue: "eastus",
      validate: (v) => (v ? undefined : "Region required"),
    }),
    onCancel,
  );
  return { apiKey: apiKey as string, region: region as string };
}

export async function gatherAzureSpeech(
  ctx: AzureContext,
  onCancel: () => never,
): Promise<{ config: AzureSpeechConfig; ctx: AzureContext }> {
  if (ctx.mode !== "az") {
    return { config: await pasteAzureSpeech(onCancel), ctx };
  }
  const nextCtx = await pickSubscription(ctx, onCancel);
  const s = spinner();
  s.start("Listing Speech services…");
  const accounts = await azListSpeechAccounts();
  s.stop(`Found ${accounts.length} Speech service${accounts.length === 1 ? "" : "s"}.`);
  if (accounts.length === 0) {
    note("No Speech accounts in this subscription. Falling back to paste.", "Azure Speech");
    return { config: await pasteAzureSpeech(onCancel), ctx: nextCtx };
  }
  const pick = await ask(
    select({
      message: "Speech service:",
      options: accounts.map((a) => ({
        value: `${a.name}|${a.resourceGroup}`,
        label: a.name,
        hint: `${a.location} · ${a.resourceGroup}`,
      })),
      initialValue: `${accounts[0].name}|${accounts[0].resourceGroup}`,
    }),
    onCancel,
  );
  const [accountName, resourceGroup] = (pick as unknown as string).split("|");
  s.start("Loading key + region…");
  const result = await azGetSpeechKey(accountName, resourceGroup);
  s.stop("Done.");
  if (!result) {
    note("Couldn't fetch the speech key. Falling back to paste.", "Azure Speech");
    return { config: await pasteAzureSpeech(onCancel), ctx: nextCtx };
  }
  return {
    config: { apiKey: result.key, region: result.region },
    ctx: nextCtx,
  };
}

async function pasteEntra(onCancel: () => never): Promise<EntraConfig> {
  note(
    [
      `${pc.dim("Create or find your app at")} ${pc.bold("portal.azure.com")} ${pc.dim("→ Microsoft Entra ID → App registrations.")}`,
      `${pc.dim("Tenant + Client IDs are on the app's")} ${pc.bold("Overview")} ${pc.dim("blade.")}`,
      `${pc.dim("Client secret is on")} ${pc.bold("Certificates & secrets → New client secret")}.`,
    ].join("\n"),
    "Entra ID — paste values",
  );
  const tenantId = await ask(
    text({
      message: "Tenant ID:",
      placeholder: "00000000-0000-0000-0000-000000000000",
      validate: (v) => (v ? undefined : "Tenant ID required"),
    }),
    onCancel,
  );
  const clientId = await ask(
    text({
      message: "Application (client) ID:",
      placeholder: "00000000-0000-0000-0000-000000000000",
      validate: (v) => (v ? undefined : "Client ID required"),
    }),
    onCancel,
  );
  const clientSecret = await ask(
    text({
      message: "Client secret value (only shown once when created):",
      placeholder: "secret value",
      validate: (v) => (v ? undefined : "Client secret required"),
    }),
    onCancel,
  );
  return {
    tenantId: tenantId as string,
    clientId: clientId as string,
    clientSecret: clientSecret as string,
  };
}

export async function gatherEntra(
  ctx: AzureContext,
  onCancel: () => never,
): Promise<{ config: EntraConfig; ctx: AzureContext }> {
  if (ctx.mode !== "az" || !ctx.account) {
    return { config: await pasteEntra(onCancel), ctx };
  }
  const s = spinner();
  s.start("Listing your app registrations…");
  const apps = await azListEntraApps();
  s.stop(`Found ${apps.length} app registration${apps.length === 1 ? "" : "s"}.`);
  if (apps.length === 0) {
    note(
      [
        "You don't own any app registrations in this tenant.",
        `Create one at ${pc.bold("portal.azure.com → Entra ID → App registrations → New")}, then paste the values here.`,
      ].join("\n"),
      "Entra ID",
    );
    return { config: await pasteEntra(onCancel), ctx };
  }
  const pick = await ask(
    select({
      message: "App registration:",
      options: apps.map((a) => ({
        value: a.appId,
        label: a.displayName || a.appId,
        hint: a.signInAudience,
      })),
      initialValue: apps[0].appId,
    }),
    onCancel,
  );
  const appId = pick as unknown as string;

  const generate = await ask(
    confirm({
      message: `Generate a fresh client secret for this app via ${pc.bold("az ad app credential reset")}?`,
      initialValue: true,
    }),
    onCancel,
  );

  let clientSecret = "";
  if (generate) {
    s.start("Resetting client secret…");
    const secret = await azResetEntraAppSecret(appId);
    s.stop(secret ? "Generated new client secret." : "Couldn't reset secret.");
    clientSecret = secret ?? "";
  }
  if (!clientSecret) {
    clientSecret = (await ask(
      text({
        message: "Paste an existing client secret value:",
        placeholder: "secret value",
        validate: (v) => (v ? undefined : "Client secret required"),
      }),
      onCancel,
    )) as string;
  }
  return {
    config: {
      tenantId: ctx.account.tenantId,
      clientId: appId,
      clientSecret,
    },
    ctx,
  };
}
