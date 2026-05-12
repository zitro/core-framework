import type { CorePhase } from "@/types/core";

export function toBackendPhase(phase?: CorePhase): string | undefined {
  if (!phase) return undefined;
  return phase === "orchestrate" ? "orient" : phase;
}
