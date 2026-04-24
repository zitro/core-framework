"use client";

/**
 * Microsoft Graph connection — fully client-side.
 *
 * PRIVACY MODEL (do not weaken):
 *   - Tenant ID + Client ID are stored ONLY in window.localStorage on this
 *     device. They are never POSTed to our backend.
 *   - Sign-in uses MSAL Browser (PKCE) directly against
 *     login.microsoftonline.com. Access / refresh tokens land in
 *     sessionStorage (tab-scoped, cleared on tab close).
 *   - "Test connection" calls graph.microsoft.com directly from the
 *     browser with the user's bearer token. The token is never sent to
 *     our server.
 *   - "Disconnect" signs the user out of MSAL AND clears the saved
 *     tenant/client from localStorage.
 *
 * Users supply their own Entra ID app registration (SPA platform,
 * redirect = window.location.origin). They never paste a client secret;
 * SPAs use PKCE and there is no secret to leak.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  Plug,
  ShieldCheck,
} from "lucide-react";
import type {
  AccountInfo,
  PublicClientApplication as PCA,
} from "@azure/msal-browser";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "core.graph.config";
const DEFAULT_SCOPES = "User.Read offline_access";
const GUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface GraphConfig {
  tenantId: string;
  clientId: string;
  scopes: string;
}

interface ProbeResult {
  ok: boolean;
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
  error?: string;
}

function loadConfig(): GraphConfig {
  if (typeof window === "undefined") {
    return { tenantId: "", clientId: "", scopes: DEFAULT_SCOPES };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tenantId: "", clientId: "", scopes: DEFAULT_SCOPES };
    const parsed = JSON.parse(raw) as Partial<GraphConfig>;
    return {
      tenantId: parsed.tenantId ?? "",
      clientId: parsed.clientId ?? "",
      scopes: parsed.scopes ?? DEFAULT_SCOPES,
    };
  } catch {
    return { tenantId: "", clientId: "", scopes: DEFAULT_SCOPES };
  }
}

function saveConfig(cfg: GraphConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function clearConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function parseScopes(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function GraphConnectionPanel() {
  const [cfg, setCfg] = useState<GraphConfig>(() => loadConfig());
  const [savedCfg, setSavedCfg] = useState<GraphConfig>(() => loadConfig());
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [busy, setBusy] = useState<"init" | "signin" | "signout" | "probe" | null>(
    "init",
  );
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const pcaRef = useRef<PCA | null>(null);

  const dirty =
    cfg.tenantId !== savedCfg.tenantId ||
    cfg.clientId !== savedCfg.clientId ||
    cfg.scopes !== savedCfg.scopes;
  const configValid =
    GUID_RE.test(savedCfg.tenantId) && GUID_RE.test(savedCfg.clientId);

  // Init MSAL whenever a valid saved config exists. Re-runs on save.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setProbe(null);
    setAccount(null);
    pcaRef.current = null;
    if (!configValid) {
      setBusy(null);
      return;
    }
    setBusy("init");
    (async () => {
      try {
        const { PublicClientApplication } = await import("@azure/msal-browser");
        const pca = new PublicClientApplication({
          auth: {
            clientId: savedCfg.clientId,
            authority: `https://login.microsoftonline.com/${savedCfg.tenantId}`,
            redirectUri:
              typeof window !== "undefined"
                ? window.location.origin
                : undefined,
          },
          cache: { cacheLocation: "sessionStorage" },
        });
        await pca.initialize();
        if (cancelled) return;
        pcaRef.current = pca;
        const active = pca.getAllAccounts()[0] ?? null;
        if (active) pca.setActiveAccount(active);
        setAccount(active);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedCfg, configValid]);

  const onSave = useCallback(() => {
    const next: GraphConfig = {
      tenantId: cfg.tenantId.trim(),
      clientId: cfg.clientId.trim(),
      scopes: cfg.scopes.trim() || DEFAULT_SCOPES,
    };
    saveConfig(next);
    setSavedCfg(next);
    setCfg(next);
  }, [cfg]);

  const onSignIn = useCallback(async () => {
    const pca = pcaRef.current;
    if (!pca) return;
    setBusy("signin");
    setError(null);
    try {
      const result = await pca.loginPopup({
        scopes: parseScopes(savedCfg.scopes),
        prompt: "select_account",
      });
      pca.setActiveAccount(result.account);
      setAccount(result.account);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [savedCfg.scopes]);

  const onSignOut = useCallback(async () => {
    const pca = pcaRef.current;
    if (!pca) return;
    setBusy("signout");
    setError(null);
    setProbe(null);
    try {
      const acct = pca.getActiveAccount() ?? undefined;
      await pca.logoutPopup({ account: acct });
      setAccount(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const onDisconnect = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Disconnect Microsoft Graph? This signs you out and removes the tenant/client from this device.",
      )
    ) {
      return;
    }
    try {
      const pca = pcaRef.current;
      if (pca && pca.getActiveAccount()) {
        await pca.logoutPopup({ account: pca.getActiveAccount() ?? undefined });
      }
    } catch {
      // ignore — we still want to clear local config
    }
    clearConfig();
    const empty: GraphConfig = {
      tenantId: "",
      clientId: "",
      scopes: DEFAULT_SCOPES,
    };
    setCfg(empty);
    setSavedCfg(empty);
    setAccount(null);
    setProbe(null);
  }, []);

  const onProbe = useCallback(async () => {
    const pca = pcaRef.current;
    const active = pca?.getActiveAccount();
    if (!pca || !active) return;
    setBusy("probe");
    setProbe(null);
    setError(null);
    try {
      const tok = await pca.acquireTokenSilent({
        scopes: parseScopes(savedCfg.scopes),
        account: active,
      });
      const r = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tok.accessToken}` },
      });
      if (!r.ok) {
        setProbe({ ok: false, error: `Graph /me returned ${r.status}` });
        return;
      }
      const j = (await r.json()) as ProbeResult;
      setProbe({
        ok: true,
        displayName: j.displayName,
        userPrincipalName: j.userPrincipalName,
        mail: j.mail,
      });
    } catch (e) {
      setProbe({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }, [savedCfg.scopes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="size-4" aria-hidden /> Microsoft Graph
          {configValid && account && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3" aria-hidden /> Signed in
            </Badge>
          )}
          {configValid && !account && (
            <Badge variant="outline">Configured</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect your Microsoft 365 account to read Graph data (files, mail,
          meetings) for grounding. Uses your own Entra ID app registration and
          MSAL PKCE — credentials and tokens stay on this device only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex gap-2">
          <ShieldCheck className="size-4 mt-0.5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <div className="font-medium">Local-only credentials</div>
            <div>
              Tenant and client IDs are stored in this browser&apos;s{" "}
              <code>localStorage</code>. Access tokens live in{" "}
              <code>sessionStorage</code> (cleared when you close the tab).
              Nothing here is sent to the CORE backend.
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="graph-tenant"
              className="text-xs font-medium text-muted-foreground"
            >
              Directory (tenant) ID
            </label>
            <Input
              id="graph-tenant"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={cfg.tenantId}
              onChange={(e) =>
                setCfg((c) => ({ ...c, tenantId: e.target.value }))
              }
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="graph-client"
              className="text-xs font-medium text-muted-foreground"
            >
              Application (client) ID
            </label>
            <Input
              id="graph-client"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={cfg.clientId}
              onChange={(e) =>
                setCfg((c) => ({ ...c, clientId: e.target.value }))
              }
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label
              htmlFor="graph-scopes"
              className="text-xs font-medium text-muted-foreground"
            >
              Scopes (space or comma separated)
            </label>
            <Input
              id="graph-scopes"
              placeholder={DEFAULT_SCOPES}
              value={cfg.scopes}
              onChange={(e) =>
                setCfg((c) => ({ ...c, scopes: e.target.value }))
              }
              spellCheck={false}
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Common: <code>User.Read</code>, <code>Files.Read.All</code>,{" "}
              <code>Mail.Read</code>, <code>Calendars.Read</code>.
            </p>
          </div>
        </div>

        {dirty && (
          <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <AlertCircle className="size-3.5" aria-hidden /> Unsaved changes —
            click Save to (re)initialize.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive flex gap-2">
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" aria-hidden />
            <div className="break-all">{error}</div>
          </div>
        )}

        {account && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{account.name ?? account.username}</div>
            <div className="text-xs text-muted-foreground">
              {account.username}
            </div>
            {probe?.ok && (
              <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" aria-hidden /> Graph /me OK
                {probe.mail ? ` — ${probe.mail}` : ""}
              </div>
            )}
            {probe && !probe.ok && (
              <div className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="size-3.5" aria-hidden /> {probe.error}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onSave}
            disabled={!dirty || busy === "init"}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={onSignIn}
            disabled={!configValid || !!account || !!busy}
          >
            {busy === "signin" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <LogIn className="size-3.5" aria-hidden />
            )}
            Sign in
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onProbe}
            disabled={!account || !!busy}
          >
            {busy === "probe" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Test connection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSignOut}
            disabled={!account || !!busy}
          >
            {busy === "signout" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <LogOut className="size-3.5" aria-hidden />
            )}
            Sign out
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDisconnect}
            disabled={(!configValid && !account) || !!busy}
          >
            Disconnect &amp; forget
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              window.open(
                "https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app",
                "_blank",
              )
            }
          >
            How to register an app
            <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
          </Button>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">
            Setup checklist
          </summary>
          <ol className="mt-2 ml-4 list-decimal space-y-1">
            <li>
              Entra admin center → App registrations → New registration.
            </li>
            <li>
              Platform: <strong>Single-page application (SPA)</strong>. Redirect
              URI: <code>{typeof window !== "undefined" ? window.location.origin : "<this app origin>"}</code>.
            </li>
            <li>
              API permissions → Microsoft Graph → Delegated → add the scopes
              you want (e.g. <code>User.Read</code>). Grant admin consent if
              required by your tenant.
            </li>
            <li>
              Copy the <em>Directory (tenant) ID</em> and{" "}
              <em>Application (client) ID</em> into the fields above and Save.
            </li>
            <li>
              Click <em>Sign in</em> — a popup completes PKCE auth against
              login.microsoftonline.com.
            </li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}
