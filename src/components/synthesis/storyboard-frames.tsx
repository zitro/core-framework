"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { SynthesisArtifact } from "@/lib/api-synthesis";
import { v2Api } from "@/lib/api-v2";

interface StoryboardFrame {
  caption?: string;
  description?: string;
  persona_action?: string;
  image_prompt?: string;
  image_url?: string;
  image_alt?: string;
  image_provider?: string;
}

interface Props {
  artifact: SynthesisArtifact;
  onUpdate: (updated: SynthesisArtifact) => void;
}

/**
 * Storyboard renderer: shows each frame as a card with image + caption +
 * description, and a single "Generate images" button that fills any frame
 * whose ``image_url`` is empty. Idempotent on the server side.
 */
export function StoryboardFrames({ artifact, onUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const projectId = artifact.project_id;
  const frames = (artifact.body?.frames as StoryboardFrame[] | undefined) ?? [];
  const persona = (artifact.body?.persona as string | undefined) ?? "";
  const takeaway = (artifact.body?.takeaway as string | undefined) ?? "";
  const missing = frames.filter((f) => !f?.image_url).length;

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const res = await v2Api.generateImages(projectId, artifact.id);
      onUpdate(res.artifact);
      const noun = res.generated === 1 ? "image" : "images";
      toast.success(
        `Generated ${res.generated} ${noun} (${res.provider})${
          res.skipped ? `, skipped ${res.skipped}` : ""
        }`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image generation failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (frames.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No frames yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {persona && <span className="font-medium">{persona}</span>}
          {persona && frames.length > 0 && <span> Â· </span>}
          <span>
            {frames.length} frame{frames.length === 1 ? "" : "s"}
            {missing > 0 ? ` Â· ${missing} missing image${missing === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant={missing > 0 ? "default" : "outline"}
          onClick={handleGenerate}
          disabled={busy || missing === 0}
          aria-label="Generate storyboard images"
        >
          <Sparkles className="size-3.5 mr-1.5" aria-hidden />
          {missing > 0 ? `Generate ${missing} image${missing === 1 ? "" : "s"}` : "Images filled"}
        </Button>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none">
        {frames.map((frame, i) => (
          <FrameCard key={i} index={i + 1} frame={frame} />
        ))}
      </ol>

      {takeaway && (
        <p className="text-sm">
          <span className="font-medium">Takeaway: </span>
          <span className="text-muted-foreground">{takeaway}</span>
        </p>
      )}
    </div>
  );
}

interface FrameCardProps {
  index: number;
  frame: StoryboardFrame;
}

function FrameCard({ index, frame }: FrameCardProps) {
  const alt = frame.image_alt ?? frame.image_prompt ?? `Frame ${index}`;
  return (
    <li className="overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square bg-muted">
        {frame.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frame.image_url}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image yet
          </div>
        )}
      </div>
      <div className="space-y-1 p-3 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            #{index}
          </span>
          {frame.caption && (
            <span className="font-medium leading-tight">{frame.caption}</span>
          )}
        </div>
        {frame.description && (
          <p className="text-muted-foreground leading-relaxed">
            {frame.description}
          </p>
        )}
      </div>
    </li>
  );
}
