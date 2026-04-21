"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  X,
  Filter,
  LayoutGrid,
  List,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EngagementContentFile, EngagementContentResult } from "@/types/core";
import { ContentCard, getTypeColor } from "@/components/context/content-card";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSlugName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function matchesSearch(file: EngagementContentFile, query: string): boolean {
  const q = query.toLowerCase();
  return (
    file.title.toLowerCase().includes(q) ||
    file.type.toLowerCase().includes(q) ||
    file.type_label.toLowerCase().includes(q) ||
    file.body.toLowerCase().includes(q) ||
    Object.values(file.frontmatter).some((v) =>
      (Array.isArray(v) ? v.join(" ") : String(v)).toLowerCase().includes(q),
    )
  );
}

/* ------------------------------------------------------------------ */
/*  Viewer                                                             */
/* ------------------------------------------------------------------ */

interface EngagementContentViewerProps {
  data: EngagementContentResult;
}

export function EngagementContentViewer({ data }: EngagementContentViewerProps) {
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "grid">("list");
  const searchRef = useRef<HTMLInputElement>(null);

  const allTypes = useMemo(() => {
    const types = new Map<string, string>();
    for (const f of data.content) types.set(f.type, f.type_label);
    return types;
  }, [data.content]);

  const filtered = useMemo(() => {
    return data.content.filter((f) => {
      if (search && !matchesSearch(f, search)) return false;
      if (activeTypes.size > 0 && !activeTypes.has(f.type)) return false;
      return true;
    });
  }, [data.content, search, activeTypes]);

  const topLevelFiles = useMemo(() => filtered.filter((f) => !f.project), [filtered]);
  const projectGroups = useMemo(() => {
    const groups: Record<string, EngagementContentFile[]> = {};
    for (const proj of data.projects) {
      const files = filtered.filter((f) => f.project === proj);
      if (files.length > 0) groups[proj] = files;
    }
    return groups;
  }, [filtered, data.projects]);

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveTypes(new Set());
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const hasFilters = search || activeTypes.size > 0;
  const defaultTab = Object.keys(projectGroups)[0] || "overview";

  return (
    <div className="space-y-4">
      {/* Search + Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search files, content, metadata... (Ctrl+F)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                title="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center rounded-lg border p-0.5">
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("list")}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("grid")}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Type filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {[...allTypes.entries()].map(([type, label]) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              title={`Filter by ${label}`}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all duration-200 ${
                activeTypes.has(type)
                  ? getTypeColor(type)
                  : "text-muted-foreground bg-transparent border-border hover:bg-muted"
              }`}
            >
              {label}
              <span className="text-[10px] opacity-60">
                {data.content.filter((f) => f.type === type).length}
              </span>
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              title="Clear all filters"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Clear all
            </button>
          )}
        </div>

        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {data.content.length} files
          </p>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No files match your filters</p>
            <button
              onClick={clearFilters}
              title="Clear all filters"
              className="mt-2 text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {topLevelFiles.length > 0 && (
              <TabsTrigger value="overview">
                Overview
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {topLevelFiles.length}
                </Badge>
              </TabsTrigger>
            )}
            {Object.entries(projectGroups).map(([proj, files]) => (
              <TabsTrigger key={proj} value={proj} className="max-w-56 truncate">
                {formatSlugName(proj)}
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {files.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {topLevelFiles.length > 0 && (
            <TabsContent value="overview">
              <FileList files={topLevelFiles} view={view} search={search} />
            </TabsContent>
          )}

          {Object.entries(projectGroups).map(([proj, files]) => (
            <TabsContent key={proj} value={proj}>
              <FileList files={files} view={view} search={search} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  File List                                                          */
/* ------------------------------------------------------------------ */

function FileList({
  files,
  view,
  search,
}: {
  files: EngagementContentFile[];
  view: "list" | "grid";
  search: string;
}) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {files.map((file) => (
          <ContentCard key={file.path} file={file} compact search={search} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {files.map((file) => (
        <ContentCard key={file.path} file={file} search={search} />
      ))}
    </div>
  );
}
