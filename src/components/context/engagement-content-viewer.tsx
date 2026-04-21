"use client";

import { useMemo, useState } from "react";
import {
  Users,
  Building2,
  Cpu,
  FileText,
  Phone,
  Mail,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EngagementContentFile, EngagementContentResult } from "@/types/core";

/** Pick an icon based on keyword patterns in the type string. */
function getTypeIcon(type: string): typeof FileText {
  if (type.includes("stakeholder") || type.includes("team")) return Users;
  if (type.includes("customer") || type.includes("company") || type.includes("org")) return Building2;
  if (type.includes("tech") || type.includes("stack") || type.includes("architecture")) return Cpu;
  if (type.includes("call") || type.includes("transcript") || type.includes("meeting")) return Phone;
  if (type.includes("email") || type.includes("mail")) return Mail;
  if (type.includes("risk") || type.includes("alert")) return AlertTriangle;
  if (type.includes("overview") || type.includes("initiative") || type.includes("project")) return Layers;
  return FileText;
}

/** Simple hash-based color assignment for consistent type coloring. */
const COLOR_PALETTE = [
  "text-blue-500 bg-blue-500/10",
  "text-emerald-500 bg-emerald-500/10",
  "text-violet-500 bg-violet-500/10",
  "text-orange-500 bg-orange-500/10",
  "text-amber-500 bg-amber-500/10",
  "text-cyan-500 bg-cyan-500/10",
  "text-red-500 bg-red-500/10",
  "text-teal-500 bg-teal-500/10",
  "text-indigo-500 bg-indigo-500/10",
];

function getTypeColor(type: string): string {
  if (!type) return "text-muted-foreground bg-muted";
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) | 0;
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

interface EngagementContentViewerProps {
  data: EngagementContentResult;
}

export function EngagementContentViewer({ data }: EngagementContentViewerProps) {
  const topLevelFiles = useMemo(
    () => data.content.filter((f) => !f.project),
    [data.content],
  );

  const projectGroups = useMemo(() => {
    const groups: Record<string, EngagementContentFile[]> = {};
    for (const proj of data.projects) {
      groups[proj] = data.content.filter((f) => f.project === proj);
    }
    return groups;
  }, [data.content, data.projects]);

  const defaultTab = data.projects[0] || "overview";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {topLevelFiles.length > 0 && (
          <TabsTrigger value="overview">Overview</TabsTrigger>
        )}
        {data.projects.map((proj) => (
          <TabsTrigger key={proj} value={proj} className="max-w-48 truncate">
            {formatSlugName(proj)}
          </TabsTrigger>
        ))}
      </TabsList>

      {topLevelFiles.length > 0 && (
        <TabsContent value="overview" className="space-y-4">
          {topLevelFiles.map((file) => (
            <ContentCard key={file.path} file={file} />
          ))}
        </TabsContent>
      )}

      {Object.entries(projectGroups).map(([proj, files]) => (
        <TabsContent key={proj} value={proj} className="space-y-4">
          {files.map((file) => (
            <ContentCard key={file.path} file={file} />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ContentCard({ file }: { file: EngagementContentFile }) {
  const [expanded, setExpanded] = useState(shouldAutoExpand(file.type));
  const Icon = getTypeIcon(file.type);
  const colorClass = getTypeColor(file.type);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${colorClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium leading-tight">
              {file.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">
                {file.type_label}
              </Badge>
              {file.frontmatter.date && (
                <span className="text-[10px] text-muted-foreground">
                  {String(file.frontmatter.date)}
                </span>
              )}
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-4">
          <FrontmatterTable frontmatter={file.frontmatter} />
          <ScrollArea className="max-h-[600px]">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownBody content={file.body} />
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}

function FrontmatterTable({ frontmatter }: { frontmatter: Record<string, string | string[]> }) {
  const displayKeys = Object.entries(frontmatter).filter(
    ([key]) => !["type", "title"].includes(key),
  );
  if (displayKeys.length === 0) return null;

  return (
    <div className="mb-3 rounded-md border p-2 text-xs">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {displayKeys.map(([key, val]) => (
          <div key={key} className="contents">
            <span className="font-medium text-muted-foreground capitalize">
              {key.replace(/-/g, " ")}
            </span>
            <span>{Array.isArray(val) ? val.join(", ") : String(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarkdownBody({ content }: { content: string }) {
  // Render markdown as structured HTML. Tables, headers, lists, and
  // paragraphs are the most common elements in engagement files.
  const html = useMemo(() => markdownToHtml(content), [content]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function markdownToHtml(md: string): string {
  let html = escapeHtml(md);

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, header: string, _sep: string, body: string) => {
      const ths = header
        .split("|")
        .filter(Boolean)
        .map((c: string) => `<th>${c.trim()}</th>`)
        .join("");
      const rows = body
        .trim()
        .split("\n")
        .map((row: string) => {
          const tds = row
            .split("|")
            .filter(Boolean)
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    },
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr />");

  // Paragraphs — blank line separated blocks
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs and paragraphs wrapping block elements
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*(<(?:h[1-4]|table|ul|hr))/g, "$1");
  html = html.replace(/(<\/(?:h[1-4]|table|ul|hr\s?\/)>)\s*<\/p>/g, "$1");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSlugName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shouldAutoExpand(type: string): boolean {
  return type.includes("overview") || type.includes("details");
}
