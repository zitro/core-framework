"use client";

import { useCallback, useEffect, useState } from "react";
import { Folder, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { EngagementSourceType } from "@/types/core";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/http";

interface EngagementSourceActionsProps {
  localFolderPath: string;
  setLocalFolderPath: (value: string) => void;
  repositoryPath: string;
  setRepositoryPath: (value: string) => void;
  scanningType: EngagementSourceType | null;
  connectedCount: number;
  checkingUpdates: boolean;
  onAddAndScan: (type: EngagementSourceType, value: string) => Promise<void>;
  onCheckUpdates: () => Promise<void>;
}

export function EngagementSourceActions({
  localFolderPath,
  setLocalFolderPath,
  repositoryPath,
  setRepositoryPath,
  scanningType,
  connectedCount,
  checkingUpdates,
  onAddAndScan,
  onCheckUpdates,
}: EngagementSourceActionsProps) {
  const [sourceEditor, setSourceEditor] = useState<EngagementSourceType | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState("");
  const [githubBusy, setGithubBusy] = useState(false);

  const refreshGithubStatus = useCallback(async () => {
    try {
      const status = await api.githubAuth.status();
      setGithubConnected(status.connected);
      setGithubLogin(status.login || "");
    } catch {
      setGithubConnected(false);
      setGithubLogin("");
    }
  }, []);

  useEffect(() => {
    if (sourceEditor !== "repository") return;
    void refreshGithubStatus();
  }, [refreshGithubStatus, sourceEditor]);

  const browseLocalFolder = useCallback(async () => {
    if (typeof window === "undefined") return;
    const pickerWindow = window as Window & {
      showDirectoryPicker?: () => Promise<{ name: string }>;
    };
    if (!pickerWindow.showDirectoryPicker) {
      toast.error("Folder picker is not supported in this browser. Paste the path manually.");
      return;
    }
    try {
      const handle = await pickerWindow.showDirectoryPicker();
      if (handle?.name) {
        const selectedFolder = handle.name;
        setLocalFolderPath(selectedFolder);
        toast.success(`Selected ${selectedFolder}`);
      } else {
        toast.error("Could not read the selected folder name. Paste the path manually.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error("Folder selection failed. Paste a mounted path manually (for example: /data/projects/<folder>). ");
    }
  }, [setLocalFolderPath]);

  const connectGithub = useCallback(async () => {
    if (githubBusy) return;
    setGithubBusy(true);

    const apiOrigin = (() => {
      try {
        return new URL(API_URL).origin;
      } catch {
        return window.location.origin;
      }
    })();

    await new Promise<void>((resolve) => {
      let resolved = false;

      const complete = () => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener("message", onMessage);
        resolve();
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== apiOrigin) return;
        if (!event.data || event.data.type !== "github-oauth") return;
        if (event.data.success) {
          toast.success("GitHub connected");
        } else {
          toast.error(event.data.error || "GitHub OAuth failed");
        }
        complete();
      };

      window.addEventListener("message", onMessage);
      const popup = window.open(
        `${API_URL}/api/github/oauth/start`,
        "core-github-oauth",
        "popup,width=540,height=720",
      );

      if (!popup) {
        toast.error("Popup blocked. Allow popups and try again.");
        complete();
        return;
      }

      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          complete();
        }
      }, 500);

      window.setTimeout(() => {
        window.clearInterval(timer);
        complete();
      }, 180000);
    });

    await refreshGithubStatus();
    setGithubBusy(false);
  }, [githubBusy, refreshGithubStatus]);

  const disconnectGithub = useCallback(async () => {
    setGithubBusy(true);
    try {
      await api.githubAuth.disconnect();
      toast.success("GitHub disconnected");
    } catch {
      /* toast handled by api */
    } finally {
      await refreshGithubStatus();
      setGithubBusy(false);
    }
  }, [refreshGithubStatus]);

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-3">
      {githubConnected && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-2">
          <Badge variant="secondary" className="text-[10px]">
            {`GitHub Connected${githubLogin ? ` (${githubLogin})` : ""}`}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => void disconnectGithub()} disabled={githubBusy}>
            {githubBusy ? "Disconnecting..." : "Disconnect GitHub"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={sourceEditor === "local_folder" ? "default" : "outline"}
          onClick={() => setSourceEditor(sourceEditor === "local_folder" ? null : "local_folder")}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Local Folder
        </Button>
        <Button
          size="sm"
          variant={sourceEditor === "repository" ? "default" : "outline"}
          onClick={() => setSourceEditor(sourceEditor === "repository" ? null : "repository")}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          GitHub Repo
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onCheckUpdates()}
          disabled={checkingUpdates || connectedCount === 0 || scanningType !== null}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {checkingUpdates ? "Checking..." : "Check Updates"}
        </Button>
      </div>

      {sourceEditor === "local_folder" && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="text-sm font-medium">Local Folder</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="min-w-[260px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="C:/path/to/local-folder"
              value={localFolderPath}
              onChange={(e) => setLocalFolderPath(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void browseLocalFolder()}
              disabled={scanningType === "local_folder"}
            >
              <Folder className="mr-1.5 h-3.5 w-3.5" />
              Browse
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onAddAndScan("local_folder", localFolderPath)}
              disabled={!localFolderPath.trim() || scanningType === "local_folder"}
            >
              {scanningType === "local_folder" ? "Adding..." : "Add"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Add automatically validates and scans the folder.
          </div>
        </div>
      )}

      {sourceEditor === "repository" && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="text-sm font-medium">GitHub Repository</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="min-w-[260px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="https://github.com/org/repo or C:/path/to/cloned-repo"
              value={repositoryPath}
              onChange={(e) => setRepositoryPath(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onAddAndScan("repository", repositoryPath)}
              disabled={!repositoryPath.trim() || scanningType === "repository"}
            >
              {scanningType === "repository" ? "Connecting..." : "Connect"}
            </Button>
            {!githubConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void connectGithub()}
                disabled={githubBusy}
              >
                {githubBusy ? "Opening..." : "Connect GitHub"}
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Connect validates and scans local clones or GitHub URLs automatically. Public repos work directly; private repos require GitHub connection or a local GITHUB_TOKEN.
          </div>
        </div>
      )}
    </div>
  );
}
