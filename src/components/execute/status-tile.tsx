interface StatusTileProps {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}

export function StatusTile({ label, value, tone = "neutral" }: StatusTileProps) {
  let toneClass = "text-foreground";
  if (tone === "good") toneClass = "text-emerald-600";
  else if (tone === "warn") toneClass = "text-amber-600";
  else if (tone === "bad") toneClass = "text-red-600";

  return (
    <div className="rounded-md border bg-background px-4 py-3 text-center">
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
