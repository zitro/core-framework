"use client";

import { BookOpen } from "lucide-react";
import { EvidenceBoard } from "@/components/evidence-board";
import { PageHeader } from "@/components/layout/page-header";

export default function EvidencePage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Tools"
        title="Evidence Board"
        description="Capture, organize, and trace evidence across all CORE phases."
        icon={BookOpen}
      />
      <EvidenceBoard />
    </div>
  );
}
