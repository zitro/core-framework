"use client";

/**
 * useTabParam — bind a controlled <Tabs> value to a ?tab=… URL search param.
 *
 * Reads the active tab from the URL on every render (falling back to
 * ``defaultTab``). Writing pushes the change back to the URL without a
 * scroll jump or full reload; the next render picks it up automatically.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useTabParam(defaultTab: string, paramName = "tab") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get(paramName) || defaultTab;

  const setTabValue = useCallback(
    (next: string) => {
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
