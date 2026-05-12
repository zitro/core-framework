import { useCallback, useEffect, useMemo, useState } from "react";
import type { Discovery, TechnologyTarget } from "@/types/core";
import type { CaptureItemType } from "./capture-context-options";

interface CaptureDraft {
  quickNote: string;
  captureItemType: CaptureItemType;
  captureReference: string;
  technologyInput: string;
  technologyFocusInput: string;
  technologyTargets: TechnologyTarget[];
}

export interface CaptureDraftState {
  hydrated: boolean;
  quickNote: string;
  setQuickNote: (v: string) => void;
  captureItemType: CaptureItemType;
  setCaptureItemType: (v: CaptureItemType) => void;
  captureReference: string;
  setCaptureReference: (v: string) => void;
  technologyInput: string;
  setTechnologyInput: (v: string) => void;
  technologyFocusInput: string;
  setTechnologyFocusInput: (v: string) => void;
  technologyTargets: TechnologyTarget[];
  setTechnologyTargets: (v: TechnologyTarget[]) => void;
}

export function useCaptureDraft(activeDiscovery: Discovery | null): CaptureDraftState {
  const discoveryId = activeDiscovery?.id || "";
  const projectId = activeDiscovery?.project_id;

  const [quickNote, setQuickNote] = useState("");
  const [captureItemType, setCaptureItemType] = useState<CaptureItemType>("note");
  const [captureReference, setCaptureReference] = useState("");
  const [technologyInput, setTechnologyInput] = useState("");
  const [technologyFocusInput, setTechnologyFocusInput] = useState("");
  const [technologyTargets, setTechnologyTargets] = useState<TechnologyTarget[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const draftKey = useMemo(
    () => `core:capture-draft:${discoveryId || projectId || "global"}`,
    [discoveryId, projectId],
  );

  const readDraft = useCallback((): CaptureDraft | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CaptureDraft;
      return {
        quickNote: parsed.quickNote || "",
        captureItemType: (parsed.captureItemType as CaptureItemType) || "note",
        captureReference: parsed.captureReference || "",
        technologyInput: parsed.technologyInput || "",
        technologyFocusInput: parsed.technologyFocusInput || "",
        technologyTargets: Array.isArray(parsed.technologyTargets) ? parsed.technologyTargets : [],
      };
    } catch {
      return null;
    }
  }, [draftKey]);

  useEffect(() => {
    if (!activeDiscovery) {
      setHydrated(false);
      return;
    }

    const draft = readDraft();
    const persistedTargets = activeDiscovery.target_technologies ?? [];
    const providerFallbackTargets = (activeDiscovery.solution_providers ?? []).map((name) => ({
      name,
      focus: "",
    }));

    const nextTargets =
      persistedTargets.length > 0
        ? persistedTargets
        : providerFallbackTargets.length > 0
          ? providerFallbackTargets
          : (draft?.technologyTargets ?? []);

    setQuickNote(draft?.quickNote || "");
    setCaptureItemType(draft?.captureItemType || "note");
    setCaptureReference(draft?.captureReference || "");
    setTechnologyInput(draft?.technologyInput || "");
    setTechnologyFocusInput(draft?.technologyFocusInput || "");
    setTechnologyTargets(nextTargets);
    setHydrated(true);
  }, [
    activeDiscovery,
    activeDiscovery?.id,
    activeDiscovery?.solution_providers,
    activeDiscovery?.target_technologies,
    readDraft,
  ]);

  useEffect(() => {
    if (!activeDiscovery || !hydrated || typeof window === "undefined") return;
    const payload: CaptureDraft = {
      quickNote,
      captureItemType,
      captureReference,
      technologyInput,
      technologyFocusInput,
      technologyTargets,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      /* ignore localStorage failures */
    }
  }, [
    activeDiscovery,
    draftKey,
    captureItemType,
    captureReference,
    hydrated,
    quickNote,
    technologyFocusInput,
    technologyInput,
    technologyTargets,
  ]);

  return {
    hydrated,
    quickNote,
    setQuickNote,
    captureItemType,
    setCaptureItemType,
    captureReference,
    setCaptureReference,
    technologyInput,
    setTechnologyInput,
    technologyFocusInput,
    setTechnologyFocusInput,
    technologyTargets,
    setTechnologyTargets,
  };
}
