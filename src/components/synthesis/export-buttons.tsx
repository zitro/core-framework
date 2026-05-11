"use client";

/**
 * ExportButtons — kick off project-wide docx / pptx renders.
 *
 * Both endpoints stream every saved artifact, so these actions are
 * project-scoped even when rendered inside an artifact-detail surface.
 */

import { useState } from "react";
import { Download, FileText, Loader2, Presentation } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { synthesisApi } from "@/lib/api-synthesis";

interface Props {
  projectId: string;
  size?: "sm" | "default";
  className?: string;
}

export function ExportButtons({ projectId, size = "sm", className }: Props) {
  const [busy, setBusy] = useState<"docx" | "pptx" | null>(null);

  const run = async (fmt: "docx" | "pptx") => {
    setBusy(fmt);
    try {
      if (fmt === "docx") await synthesisApi.exportDocx(projectId);
      else await synthesisApi.exportPptx(projectId);
      toast.success(
        fmt === "docx" ? "DOCX download started." : "PPTX download started.",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : `${fmt.toUpperCase()} export failed`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={["flex items-center gap-1.5", className].filter(Boolean).join(" ")}>
      <Button
        variant="outline"
        size={size}
        className="h-7 text-xs"
        onClick={() => void run("docx")}
        disabled={busy !== null}
        title="Download every artifact as a single .docx readout"
      >
        {busy === "docx" ? (
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        ) : (
          <FileText className="mr-1.5 h-3 w-3" />
        )}
        Export DOCX
      </Button>
      <Button
        variant="outline"
        size={size}
        className="h-7 text-xs"
        onClick={() => void run("pptx")}
        disabled={busy !== null}
        title="Download a slide-by-slide .pptx readout"
      >
        {busy === "pptx" ? (
          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
        ) : (
          <Presentation className="mr-1.5 h-3 w-3" />
        )}
        Export PPTX
      </Button>
    </div>
  );
}

/** Compact single-button menu when horizontal space is tight. */
export function ExportButtonsCompact({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await synthesisApi.exportDocx(projectId);
      toast.success("DOCX download started.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void run()} disabled={busy}>
      {busy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Download className="mr-1.5 h-3 w-3" />}
      Export
    </Button>
  );
}
