"use client";

import {
  AudioLines,
  CircleHelp,
  FileText,
  Network,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhaseShell } from "@/components/layout/phase-shell";
import { DiscoveryRequired } from "@/components/layout/discovery-required";
import { useTabParam } from "@/lib/use-tab-param";
import { OrchestrateOverviewTab } from "@/components/orchestrate/orchestrate-overview-tab";
import { OrchestrateQuestionsTab } from "@/components/orchestrate/orchestrate-questions-tab";
import { OrchestrateTranscriptsTab } from "@/components/orchestrate/orchestrate-transcripts-tab";
import { OrchestrateDraftsTab } from "@/components/orchestrate/orchestrate-drafts-tab";
import { OrchestratePersonasTab } from "@/components/orchestrate/orchestrate-personas-tab";
import { OrchestrateNarrativeTab } from "@/components/orchestrate/orchestrate-narrative-tab";
import { OrchestrateGroundedTab } from "@/components/orchestrate/orchestrate-grounded-tab";
import { useOrchestrateState } from "@/components/orchestrate/use-orchestrate-state";
import { useOrchestrateActions } from "@/components/orchestrate/use-orchestrate-actions";

export default function OrchestratePage() {
  const [activeTab, setActiveTab] = useTabParam("overview");
  const state = useOrchestrateState();
  const actions = useOrchestrateActions(state, setActiveTab);

  const {
    activeDiscovery,
    discoveryId,
    questions,
    context,
    setContext,
    workingNotes,
    setWorkingNotes,
    shortcutMessage,
    showFocusedSections,
    questionComments,
    setQuestionComments,
    questionInstructions,
    setQuestionInstructions,
    selectedQuestionIndex,
    setSelectedQuestionIndex,
    attachingQuestionEvidence,
    generating,
    savingComments,
    error,
    captureEvidence,
    usingStarterQuestions,
    savedAnalyses,
    selectedTranscriptId,
    setSelectedTranscriptId,
    analysisResult,
    extractedTranscriptEvidence,
    analyzingTranscript,
    analysisNotes,
    setAnalysisNotes,
    contextTextareaRef,
    transcriptEvidence,
    selectedTranscript,
    questionBuckets,
    activeQuestionEntry,
    questionDisplayNumberByIndex,
    questionContextBasis,
    groundingQueries,
    targetTechnologies,
    showTranscriptWorkspace,
  } = state;

  if (!activeDiscovery) {
    return <DiscoveryRequired phase="orchestrate" />;
  }

  return (
    <PhaseShell
      phase="orchestrate"
      discoveryId={discoveryId}
      showEvidencePanel={false}
      showDtMethodsPanel={false}
    >
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <TabsTrigger value="overview" className="gap-1.5">
              <Network className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5">
              <CircleHelp className="h-3.5 w-3.5" />
              Questions
            </TabsTrigger>
            {showTranscriptWorkspace && (
              <TabsTrigger value="transcripts" className="gap-1.5">
                <AudioLines className="h-3.5 w-3.5" />
                Transcripts
              </TabsTrigger>
            )}
            <TabsTrigger value="drafts" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Drafts
            </TabsTrigger>
            <TabsTrigger value="personas" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Personas
            </TabsTrigger>
            <TabsTrigger value="narrative" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Narrative
            </TabsTrigger>
            <TabsTrigger value="grounded" className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              Grounded
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OrchestrateOverviewTab
              discoveryId={discoveryId}
              context={context}
              onContextChange={setContext}
              workingNotes={workingNotes}
              onWorkingNotesChange={setWorkingNotes}
              onAddWorkingNotes={actions.addWorkingNotesToContext}
              contextTextareaRef={contextTextareaRef}
              error={error}
              shortcutMessage={shortcutMessage}
              showFocusedSections={showFocusedSections}
              onApplyIntroCallTemplate={actions.applyIntroCallTemplate}
              onLoadStarterQuestions={actions.loadStarterQuestions}
              onAppendTopicBlock={actions.appendTopicBlock}
            />
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            <OrchestrateQuestionsTab
              questionsLength={questions.length}
              usingStarterQuestions={usingStarterQuestions}
              generating={generating}
              onGenerate={actions.generateQuestions}
              questionContextBasis={questionContextBasis}
              captureEvidenceCount={captureEvidence.length}
              targetTechnologiesCount={targetTechnologies.length}
              groundingQueriesCount={groundingQueries.length}
              questionBuckets={questionBuckets}
              activeQuestionEntry={activeQuestionEntry}
              questionDisplayNumberByIndex={questionDisplayNumberByIndex}
              selectedQuestionIndex={selectedQuestionIndex}
              onSelectQuestionIndex={setSelectedQuestionIndex}
              questionComments={questionComments}
              setQuestionComments={setQuestionComments}
              questionInstructions={questionInstructions}
              setQuestionInstructions={setQuestionInstructions}
              attachingQuestionEvidence={attachingQuestionEvidence}
              onAttachEvidence={actions.attachQuestionEvidence}
              savingComments={savingComments}
              onSaveAnswers={actions.saveQuestionAnswersAsEvidence}
              error={error}
            />
          </TabsContent>

          {showTranscriptWorkspace && (
            <TabsContent value="transcripts" className="space-y-4">
              <OrchestrateTranscriptsTab
                transcriptEvidence={transcriptEvidence}
                selectedTranscript={selectedTranscript}
                selectedTranscriptId={selectedTranscriptId}
                onSelectTranscriptId={setSelectedTranscriptId}
                analyzingTranscript={analyzingTranscript}
                onAnalyzeSelected={actions.analyzeSelectedTranscript}
                savedAnalyses={savedAnalyses}
                analysisResult={analysisResult}
                extractedTranscriptEvidence={extractedTranscriptEvidence}
                analysisNotes={analysisNotes}
                onAnalysisNotesChange={setAnalysisNotes}
                onAddAnalysisNotesToContext={actions.addAnalysisNotesToContext}
              />
            </TabsContent>
          )}

          <TabsContent value="drafts" className="space-y-4">
            <OrchestrateDraftsTab discoveryId={discoveryId} activeDiscovery={activeDiscovery} />
          </TabsContent>

          <TabsContent value="personas" className="space-y-6">
            <OrchestratePersonasTab discoveryId={discoveryId} />
          </TabsContent>

          <TabsContent value="narrative" className="space-y-4">
            <OrchestrateNarrativeTab discoveryId={discoveryId} activeDiscovery={activeDiscovery} />
          </TabsContent>

          <TabsContent value="grounded" className="space-y-4">
            <OrchestrateGroundedTab discoveryId={discoveryId} />
          </TabsContent>
        </Tabs>
      </div>
    </PhaseShell>
  );
}
