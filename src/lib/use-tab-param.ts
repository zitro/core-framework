"use client";

/**
 * useTabParam — bind a controlled <Tabs> value to a ?tab=… URL search param.
 *
 * Reads the initial tab from the URL (falling back to ``defaultTab``) and
 * writes back to the URL on change without a scroll jump or full reload.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function useTabParam(defaultTab: string, paramName = "tab") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<string>(
    searchParams.get(paramName) || defaultTab,
  );

  // Mirror future URL changes (e.g. back/forward) into local state.
  useEffect(() => {
    const next = searchParams.get(paramName) || defaultTab;
    setTab((prev) => (prev === next ? prev : next));
  }, [searchParams, paramName, defaultTab]);

  const setTabValue = useCallback(
    (next: string) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultTab) params.delete(paramName);
      else params.set(paramName, next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [defaultTab, paramName, pathname, router, searchParams],
  );

  return [tab, setTabValue] as const;
}
