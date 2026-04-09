"use client";

import { useState } from "react";
import { FolderOpen, Check, AlertCircle, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface DocsPathConfigProps {
  value: string;
  onChange: (path: string) => void;
  /** When true, also saves to the discovery via PATCH. */
  discoveryId?: string;
}

export function DocsPathConfig({ value, onChange, discoveryId }: DocsPathConfigProps) {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    files: { name: string; size: number; extension: string }[];
    total_size: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    if (!value.trim()) return;
    setScanning(true);
    setError(null);
    setScanResult(null);
    try {
      const result = await api.docs.scan(value.trim());
      setScanResult({ files: result.files, total_size: result.total_size });
      onChange(result.path); // use the resolved path from backend

      if (discoveryId) {
        await api.discoveries.update(discoveryId, { docs_path: result.path } as Partial<import("@/types/core").Discovery>);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan path");
    } finally {
      setScanning(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <FolderOpen className="h-3.5 w-3.5" />
        Project Docs Folder
      </label>
      <p className="text-xs text-muted-foreground">
        Point to a local folder with project docs (.md, .txt, .yaml, etc.) — AI will use them as context.
      </p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setScanResult(null); }}
          placeholder="C:\path\to\project\docs"
          className="font-mono text-xs"
        />
        <Button size="sm" variant="outline" onClick={scan} disabled={scanning || !value.trim()}>
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Scan"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {scanResult && (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-medium">
              {scanResult.files.length} files found
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {formatSize(scanResult.total_size)}
            </Badge>
          </div>
          {scanResult.files.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {scanResult.files.slice(0, 20).map((f) => (
                <div key={f.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto shrink-0">{formatSize(f.size)}</span>
                </div>
              ))}
              {scanResult.files.length > 20 && (
                <p className="text-[10px] text-muted-foreground">
                  +{scanResult.files.length - 20} more files
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
