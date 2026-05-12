import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContextBriefVersion } from "@/types/core";

import { BriefSection } from "./brief-section";

interface BriefActiveViewProps {
  version: ContextBriefVersion;
  onPin: () => void;
}

export function BriefActiveView({ version, onPin }: BriefActiveViewProps) {
  return (
    <section className="space-y-4 border-l-2 border-brand/60 pl-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <Badge variant="secondary" className="text-[10px]">
          v{version.version}
        </Badge>
        <h3 className="font-heading text-base font-semibold">
          {version.title || "AI brief"}
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {new Date(version.created_at).toLocaleString()}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{version.summary}</p>
      {version.evidence_summary && (
        <p className="text-xs text-muted-foreground">{version.evidence_summary}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onPin}>
          Pin brief into working material
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BriefSection
          title="What we are trying to achieve"
          hint="Scope, outcomes, and success measures."
          items={version.goals}
        />
        <BriefSection
          title="Who needs to align"
          hint="Sponsors, owners, decision makers, working team."
          items={version.stakeholders}
        />
        <BriefSection
          title="What could slow delivery"
          hint="Constraints and risks to manage."
          items={[...version.constraints, ...version.risks]}
        />
        <BriefSection
          title="Decisions needed next"
          hint="Questions that should drive the next session."
          items={version.open_questions}
        />
      </div>
    </section>
  );
}
