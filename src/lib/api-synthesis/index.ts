/**
 * Synthesis API client (Phase 6I).
 *
 * Aggregates the per-endpoint-family wrappers into a single
 * ``synthesisApi`` namespace so call-sites can keep the master-era
 * ``synthesisApi.<method>(...)`` shape. Each sub-module is ≤300 lines
 * per the framework's hard file-size limit.
 *
 * Types live in ``@/types/synthesis``; the engagement-context endpoint
 * is exposed via the sibling ``engagementContextApi`` export.
 */

import { artifactsApi } from "./artifacts";
import { catalogApi } from "./catalog";
import { chatApi } from "./chat";
import { connectorsApi } from "./connectors";
import { criticApi } from "./critic";
import { notesApi } from "./notes";
import { questionsApi } from "./questions";
import { sourcesApi } from "./sources";
import { threadsApi } from "./threads";

export { engagementContextApi } from "./engagement-context";
export type { EngagementContextRecord } from "./engagement-context";

export const synthesisApi = {
  // catalog
  catalog: catalogApi.catalog,

  // artifacts
  artifacts: artifactsApi.artifacts,
  synthesize: artifactsApi.synthesize,
  regenerate: artifactsApi.regenerate,

  // questions
  questions: questionsApi.questions,
  refreshQuestions: questionsApi.refreshQuestions,

  // notes
  addNote: notesApi.addNote,

  // critic
  signals: criticApi.signals,
  compass: criticApi.compass,

  // project-wide chat (corpus-grounded)
  chat: chatApi.chat,
  chatHistory: chatApi.chatHistory,
  chatSessions: chatApi.chatSessions,

  // connectors
  connectors: connectorsApi.connectors,
  updateConnectorConfig: connectorsApi.updateConnectorConfig,

  // sources + write-back + exports
  sources: sourcesApi.sources,
  refreshSources: sourcesApi.refreshSources,
  writebackVertex: sourcesApi.writebackVertex,
  exportDocx: sourcesApi.exportDocx,
  exportPptx: sourcesApi.exportPptx,
  updateVertexSettings: sourcesApi.updateVertexSettings,
  updateOperationalSettings: sourcesApi.updateOperationalSettings,

  // per-artifact threads + grounded chat
  threads: threadsApi,
};

// Re-export types for legacy callers that imported them from this module
// (master pattern: ``import type { SynthesisArtifact } from "@/lib/api-synthesis"``).
export type {
  ArtifactChatTurnResponse,
  ArtifactCommentRecord,
  ArtifactCommentRole,
  ArtifactPushResult,
  ArtifactThreadRecord,
  CompassCategoryHealth,
  CompassHealth,
  SynthesisArtifact,
  SynthesisCatalog,
  SynthesisCatalogCategory,
  SynthesisCatalogType,
  SynthesisCategoryId,
  SynthesisChatReply,
  SynthesisChatSession,
  SynthesisChatTurn,
  SynthesisCitation,
  SynthesisCompass,
  SynthesisConnector,
  SynthesisCritique,
  SynthesisCritiqueIssue,
  SynthesisQuestion,
  SynthesisRefreshResponse,
  SynthesisRunResult,
  SynthesisSignal,
  SynthesisSignalSeverity,
  SynthesisSignalsResponse,
  SynthesisSourceDoc,
  SynthesisSources,
  SynthesisStatus,
  SynthesisWriteBackResult,
} from "@/types/synthesis";
