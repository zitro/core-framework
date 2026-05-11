"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { useDiscovery } from "@/stores/discovery-store";
import { api } from "@/lib/api";

type Audience = "executive" | "technical" | "customer" | "internal";
type Style = "narrative" | "brief" | "outline";

const AUDIENCES: Audience[] = ["executive", "technical", "customer", "internal"];
const STYLES: Style[] = ["narrative", "brief", "outline"];

interface NarrativeResult {
  headline: string;
  summary: string;
  sections: Array<{ title: string; body: string }>;
  audience: string;
  style: string;
}

export default function NarrativePage() {
  const { activeDiscovery } = useDiscovery();
  const [audience, setAudience] = useState<Audience>("executive");
  const [style, setStyle] = useState<Style>("narrative");
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NarrativeResult | null>(null);

  const generate = async () => {
    if (!activeDiscovery) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.narrative.generate({
        discovery_id: activeDiscovery.id,
        audience,
        style,
        focus: focus.trim(),
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Tools"
        title="Discovery Narrative"
        description="Synthesize the latest discovery context into a shareable story."
        icon={Sparkles}
        accent="brand"
      />

      {!activeDiscovery && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Select an active discovery from the sidebar to generate a narrative.
          </CardContent>
        </Card>
      )}

      {activeDiscovery && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{activeDiscovery.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center mr-1">Audience:</span>
              {AUDIENCES.map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={audience === a ? "default" : "outline"}
                  onClick={() => setAudience(a)}
                >
                  {a}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center mr-1">Style:</span>
              {STYLES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={style === s ? "default" : "outline"}
                  onClick={() => setStyle(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
            <Textarea
              placeholder="Optional focus (e.g. 'emphasize claims processing risk')"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              maxLength={1000}
              className="min-h-20"
            />
            <Button onClick={generate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Narrative
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg">{result.headline}</CardTitle>
              <div className="flex gap-1">
                <Badge variant="outline">{result.audience}</Badge>
                <Badge variant="outline">{result.style}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground pt-1">{result.summary}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {result.sections.map((s, i) => (
              <section key={i} className="space-y-1.5">
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.body}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
