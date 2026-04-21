"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EngagementContentFile } from "@/types/core";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

const COLOR_PALETTE = [
  "text-blue-500 bg-blue-500/10 border-blue-500/20",
  "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  "text-violet-500 bg-violet-500/10 border-violet-500/20",
  "text-orange-500 bg-orange-500/10 border-orange-500/20",
  "text-amber-500 bg-amber-500/10 border-amber-500/20",
  "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  "text-rose-500 bg-rose-500/10 border-rose-500/20",
  "text-teal-500 bg-teal-500/10 border-teal-500/20",
  "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
];

export function getTypeColor(type: string): string {
  if (!type) return "text-muted-foreground bg-muted border-border";
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = (hash * 31 + type.charCodeAt(i)) | 0;
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

export function shouldAutoExpand(type: string): boolean {
  return type.includes("overview") || type.includes("details");
}

/* ------------------------------------------------------------------ */
/*  Content Card                                                       */
/* ------------------------------------------------------------------ */

export function ContentCard({
  file,
  compact,
  search,
}: {
  file: EngagementContentFile;
  compact?: boolean;
  search?: string;
}) {
  const [expanded, setExpanded] = useState(!compact && shouldAutoExpand(file.type));
  const Icon = getTypeIcon(file.type);
  const colorClass = getTypeColor(file.type);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    if (expanded) {
      const el = bodyRef.current;
      el.style.height = "0px";
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transition = "height 300ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease";
        el.style.height = `${el.scrollHeight}px`;
        el.style.opacity = "1";
        const onEnd = () => {
          el.style.height = "auto";
          el.removeEventListener("transitionend", onEnd);
        };
        el.addEventListener("transitionend", onEnd);
      });
    }
  }, [expanded]);

  const snippet = useMemo(() => {
    const plain = file.body.replace(/[#*`|_\-[\]]/g, " ").replace(/\s+/g, " ").trim();
    return plain.slice(0, 160) + (plain.length > 160 ? "..." : "");
  }, [file.body]);

  return (
    <Card className="group/content-card transition-shadow duration-200 hover:shadow-md hover:ring-1 hover:ring-foreground/5">
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${colorClass} transition-transform duration-200 group-hover/content-card:scale-105`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium leading-tight">
              <HighlightText text={file.title} query={search} />
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] font-medium">
                {file.type_label}
              </Badge>
              {file.frontmatter.date && (
                <span className="text-[10px] text-muted-foreground">
                  {String(file.frontmatter.date)}
                </span>
              )}
            </div>
            {!expanded && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {snippet}
              </p>
            )}
          </div>
          <div
            className={`transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <div ref={bodyRef} className="overflow-hidden">
          <CardContent className="pt-0 pb-4">
            <FrontmatterTable frontmatter={file.frontmatter} />
            <ScrollArea className="max-h-[600px]">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-4 prose-h2:text-base prose-h3:text-sm prose-h2:font-semibold prose-h3:font-medium prose-p:leading-relaxed prose-li:leading-relaxed prose-table:text-xs prose-th:text-left prose-th:font-medium prose-th:text-muted-foreground prose-td:py-1 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-hr:my-4 prose-blockquote:border-l-primary/30 prose-blockquote:text-muted-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {file.body}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Highlight search matches                                           */
/* ------------------------------------------------------------------ */

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200/60 dark:bg-yellow-500/30 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Frontmatter Table                                                  */
/* ------------------------------------------------------------------ */

function FrontmatterTable({ frontmatter }: { frontmatter: Record<string, string | string[]> }) {
  const displayKeys = Object.entries(frontmatter).filter(
    ([key]) => !["type", "title"].includes(key),
  );
  if (displayKeys.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3 text-xs">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {displayKeys.map(([key, val]) => (
          <div key={key} className="contents">
            <span className="font-medium text-muted-foreground capitalize whitespace-nowrap">
              {key.replace(/-/g, " ")}
            </span>
            <span className="text-foreground">
              {Array.isArray(val) ? val.join(", ") : String(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
