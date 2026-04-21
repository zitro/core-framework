import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  validated: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  assumed: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  conflicting: "bg-red-500/10 text-red-700 border-red-500/30",
};

const FALLBACK = "bg-zinc-500/10 text-zinc-600 border-zinc-500/30";

export function ConfidenceBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("text-[10px] shrink-0", STYLES[value] ?? FALLBACK, className)}>
      {value}
    </Badge>
  );
}
