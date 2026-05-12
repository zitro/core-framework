export function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">{title}</p>
      {items.length > 0 ? (
        <ul className="list-disc list-inside text-sm space-y-1">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      )}
    </div>
  );
}
