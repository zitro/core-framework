"use client";

import { MethodInstancesPanel } from "@/components/methodology/method-instances-panel";
import { DT_METHODS } from "@/lib/dt-methods";

const PERSONA_METHOD = DT_METHODS.find((m) => m.id === "persona")!;
const EMPATHY_METHOD = DT_METHODS.find((m) => m.id === "empathy-map")!;
const JOURNEY_METHOD = DT_METHODS.find((m) => m.id === "journey-map")!;

type Props = {
  discoveryId: string;
};

export function OrchestratePersonasTab({ discoveryId }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Personas, empathy maps, and journey maps for this discovery. Generate them from the
        corpus you've captured, or add your own. Everything here also lives on the Methodology
        page and folds into every CORE synthesis prompt.
      </p>

      <section className="space-y-2">
        <header className="space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Who we're designing for
          </p>
          <h3 className="font-heading text-base font-semibold tracking-tight">Personas</h3>
        </header>
        <MethodInstancesPanel method={PERSONA_METHOD} discoveryId={discoveryId} />
      </section>

      <section className="space-y-2">
        <header className="space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            What they say, think, do, and feel
          </p>
          <h3 className="font-heading text-base font-semibold tracking-tight">
            Empathy maps
          </h3>
        </header>
        <MethodInstancesPanel method={EMPATHY_METHOD} discoveryId={discoveryId} />
      </section>

      <section className="space-y-2">
        <header className="space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            How the work flows
          </p>
          <h3 className="font-heading text-base font-semibold tracking-tight">
            Journey maps
          </h3>
        </header>
        <MethodInstancesPanel method={JOURNEY_METHOD} discoveryId={discoveryId} />
      </section>
    </div>
  );
}
