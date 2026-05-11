"use client";

/**
 * CompanyResearchPanel — AI research agent.
 *
 * Purpose: enter a company name, get a structured profile (industry,
 * strategic priorities, products, competition, open questions, news,
 * sources). One-shot research — paste useful findings into Capture's
 * Context tab to persist as evidence.
 */

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { companyResearcherApi } from "@/lib/api-fde";
import { useDiscovery } from "@/stores/discovery-store";
import type { CompanyProfile } from "@/types/fde";

export function CompanyResearchPanel() {
  const { activeDiscovery } = useDiscovery();
  const [company, setCompany] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const run = async () => {
    if (!company.trim()) return;
    setBusy(true);
    try {
      const out = await companyResearcherApi.run({
        company,
        discovery_id: activeDiscovery?.id ?? "",
        user_instructions: instructions,
      });
      setProfile(out.data.result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Input
          placeholder="Company name (e.g. Contoso Energy)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="text-sm"
        />
        <Textarea
          placeholder="Optional focus — e.g. AI strategy, recent acquisitions"
          rows={2}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" type="submit" disabled={busy || !company.trim()}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Researching…
              </>
            ) : (
              "Run researcher"
            )}
          </Button>
        </div>
      </form>

      {profile && (
        <section className="space-y-4 border-l-2 border-brand/60 pl-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-heading text-base font-semibold">{profile.company}</h3>
            {profile.industry && (
              <Badge variant="outline" className="text-[10px]">
                {profile.industry}
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{profile.summary}</p>

          <ProfileSection title="Strategic priorities" items={profile.strategic_priorities} />
          <ProfileSection title="Products & services" items={profile.products_services} />
          <ProfileSection title="Competitive landscape" items={profile.competitive_landscape} />
          <ProfileSection title="Open questions" items={profile.open_questions} />

          {profile.recent_news?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Recent news
              </p>
              <ul className="space-y-0.5">
                {profile.recent_news.map((n, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-muted py-0.5 pl-2.5 text-xs"
                  >
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-foreground/85 hover:text-brand hover:underline"
                    >
                      {n.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {n.date && (
                      <span className="ml-1 text-[10px] text-muted-foreground">· {n.date}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {profile.sources?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Sources
              </p>
              <ul className="space-y-0.5">
                {profile.sources.map((s, i) => (
                  <li key={i} className="text-xs">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground/85 hover:text-brand hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProfileSection({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="border-l-2 border-muted py-0.5 pl-2.5 text-xs leading-relaxed"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
