"use client";

/**
 * RowsEditor — generic typed-row table editor for stakeholders, metrics,
 * milestones. Each column is a { key, label, placeholder } and rows are
 * Record<string,string>. Add and remove rows; values are committed live.
 */

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ColumnDef<T> {
  key: keyof T & string;
  label: string;
  placeholder?: string;
  width?: string;
}

interface Props<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  empty: T;
  onChange: (next: T[]) => void;
  emptyHint?: string;
}

export function RowsEditor<T>({
  columns,
  rows,
  empty,
  onChange,
  emptyHint,
}: Props<T>) {
  const setCell = (i: number, key: keyof T & string, val: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
    onChange(next);
  };

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const addRow = () => onChange([...rows, { ...empty }]);

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint ?? "No entries yet."}</p>
      ) : (
        <div className="space-y-1.5">
          <div
            className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:gap-2"
            style={{
              gridTemplateColumns: `${columns.map((c) => c.width ?? "1fr").join(" ")} auto`,
            }}
          >
            {columns.map((c) => (
              <span key={c.key}>{c.label}</span>
            ))}
            <span className="sr-only">Actions</span>
          </div>
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid"
              style={{
                gridTemplateColumns: `${columns.map((c) => c.width ?? "1fr").join(" ")} auto`,
              }}
            >
              {columns.map((c) => (
                <Input
                  key={c.key}
                  value={String(row[c.key] ?? "")}
                  onChange={(e) => setCell(i, c.key, e.target.value)}
                  placeholder={c.placeholder ?? c.label}
                  aria-label={`${c.label} for row ${i + 1}`}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label={`Remove row ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add row
      </Button>
    </div>
  );
}
