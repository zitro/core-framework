"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked, FileText, Library } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MethodInstancesPanel } from "@/components/methodology/method-instances-panel";
import { useDiscovery } from "@/stores/discovery-store";
import { methodologyApi, type MethodologyArtifact } from "@/lib/api-methodology";
import { useTabParam } from "@/lib/use-tab-param";
import {
  DT_METHODS,
  DT_PRINCIPLES,
  FDE_METHODS,
  FDE_PRINCIPLES,
  FDE_STAGE_LABEL,
  PHASE_TO_DT_STAGE,
  type CorePhase,
  type DtMethod,
  type FdeMethod,
  type FdeStage,
} from "@/lib/dt-methods";

const TEMPLATE_METHODS: AnyMethod[] = [
  ...DT_METHODS.filter((m) => m.template),
  ...FDE_METHODS.filter((m) => m.template),
];

const PHASES: CorePhase[] = ["capture", "orchestrate", "refine", "execute"];
const FDE_STAGES: FdeStage[] = ["embed", "prototype", "ship", "learn"];

type AnyMethod = (DtMethod | FdeMethod) & { template?: string };

export default function MethodologyPage() {
  const { activeDiscovery } = useDiscovery();
  const discoveryId = activeDiscovery?.id;
  const [tab, setTab] = useTabParam("templates");

  const [allInstances, setAllInstances] = useState<MethodologyArtifact[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetcher = discoveryId
      ? methodologyApi.list(discoveryId)
      : Promise.resolve<MethodologyArtifact[]>([]);
    fetcher
      .then((rows) => {
        if (!cancelled) setAllInstances(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [discoveryId]);

  const countByMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allInstances) map.set(r.method_id, (map.get(r.method_id) ?? 0) + 1);
    return map;
  }, [allInstances]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        eyebrow="Tools"
        title="Methodology"
        description="CORE is built on Design Thinking and Forward-Deployed Engineering. Use these methods to anchor the work; fill the templates to anchor what CORE generates."
        icon={BookMarked}
        accent="brand"
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList variant="line" className="gap-3 border-b">
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-1.5">
            <Library className="h-3.5 w-3.5" />
            Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Fillable templates for this discovery. Generate from the corpus you&apos;ve captured, or
            add your own — everything you save feeds into every CORE synthesis prompt and shows up
            on the Orchestrate Personas tab.
          </p>
          <div className="space-y-5">
            {TEMPLATE_METHODS.map((m) => (
              <article key={m.id} className="space-y-2.5">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div className="space-y-0.5">
                    <h3 className="font-heading text-base font-semibold tracking-tight">
                      {m.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{m.oneLiner}</p>
                  </div>
                  {m.template && (countByMethod.get(m.template) ?? 0) > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {countByMethod.get(m.template)} saved
                    </Badge>
                  )}
                </header>
                <MethodInstancesPanel method={m} discoveryId={discoveryId} />
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-8">
          <LensesIntro />
          <PrinciplesSection />

          <section className="space-y-4">
            <header className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Design Thinking
              </p>
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                Design Thinking through CORE
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                The five DT stages map onto CORE&apos;s four phases. Reach for these methods at the
                right time, not all at once.
              </p>
            </header>

            <div className="space-y-5">
              {PHASES.map((phase) => {
                const methods = DT_METHODS.filter((m) => m.phase === phase);
                return (
                  <article key={phase} className="space-y-2.5">
                    <header className="flex items-center justify-between gap-2 border-b pb-2">
                      <h3 className="font-heading text-base font-semibold tracking-tight capitalize">
                        {phase}
                      </h3>
                      <Badge variant="outline" className="text-[10px]">
                        {PHASE_TO_DT_STAGE[phase]}
                      </Badge>
                    </header>
                    <div className="space-y-3">
                      {methods.map((m) => (
                        <MethodRow key={m.id} method={m} />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <header className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Forward-Deployed Engineering
              </p>
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                FDE practices
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Design Thinking frames the work; FDE ships it. These practices overlay every CORE
                phase — they&apos;re how a small team gets to working software in days, not months.
              </p>
            </header>

            <div className="space-y-5">
              {FDE_STAGES.map((stage) => {
                const methods = FDE_METHODS.filter((m) => m.stage === stage);
                return (
                  <article key={stage} className="space-y-2.5">
                    <header className="flex items-center justify-between gap-2 border-b pb-2">
                      <h3 className="font-heading text-base font-semibold tracking-tight">
                        {FDE_STAGE_LABEL[stage]}
                      </h3>
                      <Badge variant="outline" className="text-[10px]">
                        {methods.length} {methods.length === 1 ? "practice" : "practices"}
                      </Badge>
                    </header>
                    <div className="space-y-3">
                      {methods.map((m) => (
                        <MethodRow key={m.id} method={m} />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LensesIntro() {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <LensCard
        eyebrow="Lens 1"
        title="Design Thinking"
        body="A discipline of caring about the right problem. We empathize with the people doing the work, define what's really happening, ideate widely, prototype cheap, and test against reality. The output is clarity — not a roadmap."
      />
      <LensCard
        eyebrow="Lens 2"
        title="Forward-Deployed Engineering"
        body="A discipline of shipping at the speed of clarity. Embed beside the customer, build the thinnest production-real slice, ship daily, learn aloud. The output is working software the user is already using by week two."
      />
    </section>
  );
}

function LensCard({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="relative rounded-xl border bg-card p-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-l-xl before:bg-brand">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>
      <h3 className="mt-1 font-heading text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{body}</p>
    </div>
  );
}

function PrinciplesSection() {
  const items = useMemo(
    () => [
      { label: "Design Thinking principles", items: DT_PRINCIPLES },
      { label: "FDE principles", items: FDE_PRINCIPLES },
    ],
    [],
  );
  return (
    <section className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Principles we hold to
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {items.map((col) => (
          <div key={col.label} className="space-y-2">
            <h3 className="text-xs font-semibold text-foreground/85">{col.label}</h3>
            <ol className="space-y-1">
              {col.items.map((p, i) => (
                <li
                  key={p}
                  className="flex gap-2 border-l-2 border-muted py-0.5 pl-2.5 text-sm leading-relaxed text-foreground/85"
                >
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function MethodRow({ method }: { method: AnyMethod }) {
  const hasTemplate = Boolean(method.template);
  return (
    <div className="space-y-1 border-l-2 border-muted pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{method.name}</h4>
        {hasTemplate && (
          <Badge variant="outline" className="text-[10px]">
            Template available
          </Badge>
        )}
      </div>
      <p className="text-sm leading-relaxed">{method.oneLiner}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium">When to use:</span> {method.whenToUse}
      </p>
    </div>
  );
}
