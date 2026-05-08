"use client";

import { CheckCircle2, ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Step Indicator                                                     */
/* ------------------------------------------------------------------ */

type IngestStep = "input" | "classifying" | "preview" | "writing" | "done";

const STEPS: { key: IngestStep; label: string }[] = [
  { key: "input", label: "Paste" },
  { key: "classifying", label: "Classify" },
  { key: "preview", label: "Preview" },
  { key: "writing", label: "Write" },
  { key: "done", label: "Done" },
];

export function StepIndicator({ current }: { current: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-center gap-1">
      {STEPS.map((s, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={`flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium transition-all duration-300 ${
                isActive
                  ? "bg-primary text-primary-foreground scale-105"
                  : isDone
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isDone && <CheckCircle2 className="h-3 w-3" />}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className={`h-3 w-3 ${isDone ? "text-emerald-500" : "text-muted-foreground/40"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confidence Badge                                                   */
/* ------------------------------------------------------------------ */

export function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    low: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${styles[level]}`}>
      {level} confidence
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Card                                                        */
/* ------------------------------------------------------------------ */

export function DetailCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium capitalize">{value.replace(/-/g, " ")}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}
