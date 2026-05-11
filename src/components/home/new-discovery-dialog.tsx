"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DocsPathConfig } from "@/components/settings/docs-path-config";
import type { DiscoveryMode } from "@/types/core";
import { MODE_CONFIG } from "@/types/core";

interface NewDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  mode: DiscoveryMode;
  docsPath: string;
  engagementPath: string;
  loading: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onModeChange: (v: DiscoveryMode) => void;
  onDocsPathChange: (v: string) => void;
  onEngagementPathChange: (v: string) => void;
  onCreate: () => void;
}

/** Modal for starting a new discovery. Receives all controlled state
 *  from the parent so creation logic stays on the dashboard page. */
export function NewDiscoveryDialog(props: NewDiscoveryDialogProps) {
  const {
    open, onOpenChange, name, description, mode, docsPath, engagementPath,
    loading, onNameChange, onDescriptionChange, onModeChange, onDocsPathChange,
    onEngagementPathChange, onCreate,
  } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a new discovery</DialogTitle>
          <DialogDescription>
            Choose a discovery mode and describe the engagement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Trading Platform Discovery"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What are you trying to discover?"
              rows={3}
              className="max-h-40 resize-y"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Discovery mode</label>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {(Object.entries(MODE_CONFIG) as [DiscoveryMode, typeof MODE_CONFIG.standard][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    onClick={() => onModeChange(key)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      mode === key
                        ? "border-brand bg-brand/5"
                        : "border-border hover:border-brand/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{config.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {config.duration}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
                  </button>
                ),
              )}
            </div>
          </div>
          <DocsPathConfig value={docsPath} onChange={onDocsPathChange} />
          <div>
            <label className="text-sm font-medium">Engagement repo (optional)</label>
            <Input
              value={engagementPath}
              onChange={(e) => onEngagementPathChange(e.target.value)}
              placeholder="/path/to/engagement-repo"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Path to a cloned engagement repo for note ingestion.
            </p>
          </div>
          <Button onClick={onCreate} disabled={!name.trim() || loading} className="w-full">
            {loading ? "Creating..." : "Start discovery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
