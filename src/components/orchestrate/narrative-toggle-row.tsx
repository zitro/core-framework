import { cn } from "@/lib/utils";

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  tagline: string;
}

/** Pill-button toggle group used for audience + style selectors on the
 *  Narrative tab. The selected option's tagline renders below as a
 *  microcopy line so the user always knows what the choice means. */
export function ToggleRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ToggleOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.tagline}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              value === opt.value
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {options.find((o) => o.value === value)?.tagline}
      </p>
    </div>
  );
}
