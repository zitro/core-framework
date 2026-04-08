"use client";

import { BookOpen } from "lucide-react";
import { EvidenceBoard } from "@/components/evidence-board";

export default function EvidencePage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
          <BookOpen className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evidence Board</h1>
          <p className="text-muted-foreground text-sm">
            Capture, organize, and trace evidence across all CORE phases
          </p>
        </div>
      </div>

      <EvidenceBoard />
    </div>
  );
}
