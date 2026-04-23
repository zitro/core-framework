"use client";

import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { companyResearcherApi } from "@/lib/api-fde";
import { useDiscovery } from "@/stores/discovery-store";
import type { CompanyProfile } from "@/types/fde";

export function CompanyPanel() {
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run researcher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Textarea
            placeholder="Optional focus (e.g. AI strategy, recent acquisitions)…"
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <Button size="sm" onClick={run} disabled={busy || !company.trim()}>
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Researching…
              </>
            ) : (
              "Run"
            )}
          </Button>
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{profile.company}</CardTitle>
              {profile.industry && <Badge variant="outline">{profile.industry}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">{profile.summary}</p>
            <Section title="Strategic priorities" items={profile.strategic_priorities} />
            <Section title="Products & services" items={profile.products_services} />
            <Section title="Competitive landscape" items={profile.competitive_landscape} />
            <Section title="Open questions" items={profile.open_questions} />
            {profile.recent_news?.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent news
                </h3>
                <ul className="space-y-1.5">
                  {profile.recent_news.map((n, i) => (
                    <li key={i} className="text-xs">
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {n.title}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {n.date && <span className="text-muted-foreground"> · {n.date}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.sources?.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sources
                </h3>
                <ul className="space-y-1 text-xs">
                  {profile.sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
