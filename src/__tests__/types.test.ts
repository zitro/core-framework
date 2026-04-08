import { describe, it, expect } from "vitest";
import {
  PHASE_CONFIG,
  MODE_CONFIG,
  type CorePhase,
  type DiscoveryMode,
} from "@/types/core";

describe("PHASE_CONFIG", () => {
  const phases: CorePhase[] = ["capture", "orient", "refine", "execute"];

  it("has config for all four phases", () => {
    phases.forEach((phase) => {
      expect(PHASE_CONFIG[phase]).toBeDefined();
      expect(PHASE_CONFIG[phase].label).toBeTruthy();
      expect(PHASE_CONFIG[phase].description).toBeTruthy();
    });
  });

  it("labels are properly capitalized", () => {
    expect(PHASE_CONFIG.capture.label).toBe("Capture");
    expect(PHASE_CONFIG.orient.label).toBe("Orient");
    expect(PHASE_CONFIG.refine.label).toBe("Refine");
    expect(PHASE_CONFIG.execute.label).toBe("Execute");
  });
});

describe("MODE_CONFIG", () => {
  const modes: DiscoveryMode[] = ["standard", "fde", "workshop_sprint"];

  it("has config for all three modes", () => {
    modes.forEach((mode) => {
      expect(MODE_CONFIG[mode]).toBeDefined();
      expect(MODE_CONFIG[mode].label).toBeTruthy();
      expect(MODE_CONFIG[mode].duration).toBeTruthy();
    });
  });
});
