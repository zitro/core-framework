import { blueprints } from "@/lib/api/blueprints";
import { contextBriefs } from "@/lib/api/context-briefs";
import { githubAuth, health, me, search } from "@/lib/api/core";
import { discoveries } from "@/lib/api/discoveries";
import { docs } from "@/lib/api/docs";
import { engagement } from "@/lib/api/engagement";
import { evidence } from "@/lib/api/evidence";
import { executeOutputs } from "@/lib/api/execute-outputs";
import { exportApi } from "@/lib/api/exports";
import { narrative } from "@/lib/api/narrative";
import { problemStatements } from "@/lib/api/problem-statements";
import { questions } from "@/lib/api/questions";
import { refine } from "@/lib/api/refine";
import { transcripts } from "@/lib/api/transcripts";
import { useCases } from "@/lib/api/use-cases";

export const api = {
  health,
  me,
  githubAuth,
  discoveries,
  questions,
  transcripts,
  contextBriefs,
  evidence,
  problemStatements,
  export: exportApi,
  docs,
  useCases,
  blueprints,
  executeOutputs,
  refine,
  engagement,
  search,
  narrative,
};
