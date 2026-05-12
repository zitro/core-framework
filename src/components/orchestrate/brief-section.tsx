interface BriefSectionProps {
  title: string;
  hint: string;
  items: string[];
}

export function BriefSection({ title, hint, items }: BriefSectionProps) {
  return (
    <section className="space-y-1.5">
      <div className="space-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {items.length > 0 ? (
        <ol className="space-y-1">
          {items.map((item, index) => (
            <li
              key={`${title}:${index}`}
              className="flex gap-2 border-l-2 border-muted py-0.5 pl-2.5 text-xs leading-relaxed"
            >
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {index + 1}.
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">Nothing explicit yet.</p>
      )}
    </section>
  );
}
