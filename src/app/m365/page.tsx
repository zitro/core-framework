"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  ExternalLink,
  Files,
  Mail,
  Calendar,
  Briefcase,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { m365Api, type GraphMeeting } from "@/lib/api-m365";

type Tab = "files" | "messages" | "meetings" | "accounts";

export default function M365Page() {
  const [tab, setTab] = useState<Tab>("files");
  const [graphEnabled, setGraphEnabled] = useState<boolean | null>(null);
  const [crmEnabled, setCrmEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    m365Api.graphStatus().then((s) => setGraphEnabled(s.enabled)).catch(() => {});
    m365Api.dynamicsStatus().then((s) => setCrmEnabled(s.enabled)).catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
          <Cloud className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Microsoft 365</h1>
          <p className="text-muted-foreground text-sm">
            Read-only access to Graph (files, messages, meetings) and Dynamics 365 accounts.
          </p>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        <Badge variant={graphEnabled ? "default" : "outline"}>
          Graph {graphEnabled ? "enabled" : "disabled"}
        </Badge>
        <Badge variant={crmEnabled ? "default" : "outline"}>
          Dynamics {crmEnabled ? "enabled" : "disabled"}
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="files">
            <Files className="h-3.5 w-3.5 mr-1.5" />
            Files
          </TabsTrigger>
          <TabsTrigger value="messages">
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="meetings">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <Briefcase className="h-3.5 w-3.5 mr-1.5" />
            Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <SearchPanel
            placeholder="Search SharePoint / OneDrive files…"
            run={(q) => m365Api.searchFiles(q).then((d) => d.items)}
            render={(f) => (
              <ItemRow
                key={f.id}
                title={f.name}
                subtitle={`${f.last_modified || ""} · ${formatSize(f.size)}`}
                snippet={f.snippet}
                href={f.web_url}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="messages">
          <SearchPanel
            placeholder="Search Outlook messages…"
            run={(q) => m365Api.searchMessages(q).then((d) => d.items)}
            render={(m) => (
              <ItemRow
                key={m.id}
                title={m.subject || "(no subject)"}
                subtitle={`${m.sender} · ${m.received}`}
                snippet={m.snippet}
                href={m.web_url}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingsPanel />
        </TabsContent>

        <TabsContent value="accounts">
          <SearchPanel
            placeholder="Search Dynamics accounts…"
            run={(q) => m365Api.searchAccounts(q).then((d) => d.items)}
            render={(a) => (
              <ItemRow
                key={a.id}
                title={a.name}
                subtitle={[a.industry, a.website].filter(Boolean).join(" · ")}
                snippet={a.revenue ? `Revenue: ${a.revenue}` : ""}
                href={a.website}
              />
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SearchPanel<T>({
  placeholder,
  run,
  render,
}: {
  placeholder: string;
  run: (q: string) => Promise<T[]>;
  render: (item: T) => React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setItems(await run(q));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
        <Button size="sm" onClick={go} disabled={busy || !q.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No results yet.</p>
        ) : (
          items.map((it) => render(it))
        )}
      </div>
    </div>
  );
}

function MeetingsPanel() {
  const [items, setItems] = useState<GraphMeeting[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setBusy(true);
    try {
      const d = await m365Api.meetings(7, 25);
      setItems(d.items);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-3 mt-3">
      <Button size="sm" onClick={reload} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
      </Button>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No meetings in the next 7 days (or provider disabled).
        </p>
      ) : (
        items.map((m) => (
          <ItemRow
            key={m.id}
            title={m.subject || "(no subject)"}
            subtitle={`${m.organizer} · ${m.start} → ${m.end}`}
            snippet={m.snippet}
            href={m.join_url}
          />
        ))
      )}
    </div>
  );
}

function ItemRow({
  title,
  subtitle,
  snippet,
  href,
}: {
  title: string;
  subtitle?: string;
  snippet?: string;
  href?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              {title}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            title
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-1">
        {subtitle && <div className="text-muted-foreground">{subtitle}</div>}
        {snippet && <p className="text-muted-foreground line-clamp-3">{snippet}</p>}
      </CardContent>
    </Card>
  );
}

function formatSize(n: number): string {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
