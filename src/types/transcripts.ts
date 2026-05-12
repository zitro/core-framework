import type { ConfidenceLevel, CorePhase } from "./phases";
import type { Evidence } from "./evidence";

export interface TranscriptInsight {
  text: string;
  confidence: ConfidenceLevel;
  phase: CorePhase;
}

export interface TranscriptAnalysis {
  id: string;
  discovery_id: string;
  transcript_text: string;
  insights: TranscriptInsight[];
  evidence_extracted: Evidence[];
  sentiment: string;
  key_themes: string[];
  created_at: string;
}
