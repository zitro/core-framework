"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AccountInfo,
  PublicClientApplication as PCA,
} from "@azure/msal-browser";

const TENANT = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || "";
const CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "";
const ENABLED =
  (process.env.NEXT_PUBLIC_AUTH_ENABLED || "").toLowerCase() === "true" &&
  TENANT.length > 0 &&
  CLIENT_ID.length > 0;

const SCOPES = CLIENT_ID
  ? [`api://${CLIENT_ID}/access_as_user`]
  : ["openid", "profile"];

export interface AuthState {
  enabled: boolean;
  ready: boolean;
  account: { name: string; username: string } | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState>({
  enabled: false,
  ready: true,
  account: null,
  signIn: async () => {},
  signOut: async () => {},
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!ENABLED);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const pcaRef = useRef<PCA | null>(null);

  useEffect(() => {
    if (!ENABLED) return;
    let cancelled = false;
    (async () => {
      const { PublicClientApplication } = await import("@azure/msal-browser");
      const pca = new PublicClientApplication({
        auth: {
          clientId: CLIENT_ID,
          authority: `https://login.microsoftonline.com/${TENANT}`,
          redirectUri:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
        cache: { cacheLocation: "sessionStorage" },
      });
      await pca.initialize();
      const result = await pca.handleRedirectPromise();
      if (cancelled) return;
      const active = result?.account ?? pca.getAllAccounts()[0] ?? null;
      if (active) pca.setActiveAccount(active);
      pcaRef.current = pca;
      setAccount(active);
      setReady(true);
    })().catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    const pca = pcaRef.current;
    if (!pca) return;
    await pca.loginRedirect({ scopes: SCOPES });
  }, []);

  const signOut = useCallback(async () => {
    const pca = pcaRef.current;
    if (!pca) return;
    await pca.logoutRedirect();
  }, []);

  const getToken = useCallback(async () => {
    const pca = pcaRef.current;
    const active = pca?.getActiveAccount();
    if (!pca || !active) return null;
    try {
      const result = await pca.acquireTokenSilent({
        scopes: SCOPES,
        account: active,
      });
      return result.accessToken;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      enabled: ENABLED,
      ready,
      account: account
        ? { name: account.name ?? account.username, username: account.username }
        : null,
      signIn,
      signOut,
      getToken,
    }),
    [ready, account, signIn, signOut, getToken],
  );

  if (typeof window !== "undefined") {
    (window as unknown as { __coreGetToken?: () => Promise<string | null> }).__coreGetToken =
      getToken;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
