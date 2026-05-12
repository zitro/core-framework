import type { ReactNode } from "react";

interface ActionPanelProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function ActionPanel({ title, description, children }: ActionPanelProps) {
  return (
    <div className="rounded-md border p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
