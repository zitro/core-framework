import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContextBriefVersion } from "@/types/core";

interface BriefHistoryListProps {
  versions: ContextBriefVersion[];
  onSelect: (version: ContextBriefVersion) => void;
}

export function BriefHistoryList({ versions, onSelect }: BriefHistoryListProps) {
  return (
    <ScrollArea className="max-h-48">
      <ul className="space-y-1">
        {[...versions].reverse().map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onSelect(v)}
              className="group flex w-full cursor-pointer items-start gap-2 border-l-2 border-muted py-1 pl-2.5 text-left text-xs transition-colors hover:border-brand/60"
            >
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                v{v.version}
              </Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{v.title || v.summary}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
