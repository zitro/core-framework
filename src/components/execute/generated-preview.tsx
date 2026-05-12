import type { ExecuteOutputVersion } from "@/types/core";

interface GeneratedPreviewProps {
  output: ExecuteOutputVersion;
}

export function GeneratedPreview({ output }: GeneratedPreviewProps) {
  return (
    <div className="rounded-md bg-muted/40 p-3 text-sm space-y-2">
      <p className="font-medium">{output.headline}</p>
      <p className="text-muted-foreground">{output.summary}</p>
      {output.sections.slice(0, 2).map((section) => (
        <div key={section.title}>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{section.title}</p>
          <p className="text-xs leading-relaxed">{section.body}</p>
        </div>
      ))}
    </div>
  );
}
