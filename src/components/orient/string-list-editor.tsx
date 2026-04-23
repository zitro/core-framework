"use client";

/**
 * StringListEditor — reusable input row + chip list for free-text bullets.
 *
 * Used by the engagement brief form for scope_in, scope_out, constraints,
 * assumptions, risks. Adds on Enter or click; removes on chip x.
 */

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  emptyHint?: string;
}

export function StringListEditor({
  value,
  onChange,
  placeholder = "Add an item",
  ariaLabel = "Add item",
  emptyHint,
}: Props) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft("");
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={add}
          disabled={!draft.trim()}
          aria-label={ariaLabel}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length === 0 ? (
        emptyHint ? (
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        ) : null
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <li key={`${i}-${item}`}>
              <Badge variant="secondary" className="gap-1.5 pr-1">
                <span className="max-w-[40ch] truncate">{item}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-sm p-0.5 hover:bg-background/60"
                  aria-label={`Remove ${item}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
