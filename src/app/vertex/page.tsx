"use client";

/**
 * Vertex repo viewer (v2.0).
 *
 * Tree of markdown/json files in the connected vertex repo on the left,
 * rendered markdown of the selected file on the right. Read-only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { File, FolderClosed, FolderOpen, GitBranch } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useProject } from "@/stores/project-store";
import {
  v2Api,
  type VertexFileResponse,
  type VertexTreeNode,
  type VertexTreeResponse,
} from "@/lib/api-v2";

export default function VertexPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? "";
  const [tree, setTree] = useState<VertexTreeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<VertexFileResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const loadTree = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const t = await v2Api.vertexTree(projectId);
      setTree(t);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (!selected || !projectId) {
      setFile(null);
      return;
    }
    let cancelled = false;
    setFileLoading(true);
    v2Api
      .vertexFile(projectId, selected)
      .then((res) => {
        if (!cancelled) setFile(res);
      })
      .catch(() => {
        if (!cancelled) setFile(null);
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, selected]);

  const root = tree?.root;

  if (!projectId) {
    return <Hero title="No project selected" body="Pick a project in the sidebar." />;
  }
  if (loading && !tree) {
    return <Hero title="Reading vertex repoâ€¦" body="" />;
  }
  if (tree && !tree.available) {
    return (
      <Hero
        title="No vertex repo connected"
        body={tree.reason || "Set repo_path on the project to enable this view."}
      />
    );
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[18rem_1fr]">
      <aside className="overflow-y-auto border-r bg-muted/20 p-3">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="size-3.5" aria-hidden />
          <span className="truncate" title={tree?.repo_path}>
            {tree?.repo_path}
          </span>
        </div>
        {root && (
          <ul className="space-y-0.5 text-sm" role="tree">
            {root.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={0}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </ul>
        )}
      </aside>
      <main className="overflow-y-auto p-6">
        {!selected && (
          <Hero
            title="Pick a file"
            body="Choose any markdown or JSON file on the left to render it here."
          />
        )}
        {selected && fileLoading && (
          <p className="text-sm text-muted-foreground">Loadingâ€¦</p>
        )}
        {selected && file && !fileLoading && <FileView file={file} />}
      </main>
    </div>
  );
}

interface TreeItemProps {
  node: VertexTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}

function TreeItem({ node, depth, selected, onSelect }: TreeItemProps) {
  const [open, setOpen] = useState(depth < 1);
  const padding = useMemo(() => ({ paddingLeft: 8 + depth * 12 }), [depth]);
  if (node.kind === "dir") {
    return (
      <li role="treeitem" aria-expanded={open} aria-selected={false}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-accent"
          style={padding}
        >
          {open ? (
            <FolderOpen className="size-3.5 text-amber-500" aria-hidden />
          ) : (
            <FolderClosed className="size-3.5 text-amber-500" aria-hidden />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <ul className="space-y-0.5">
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }
  const isActive = selected === node.path;
  return (
    <li role="treeitem" aria-selected={isActive}>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={
          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition " +
          (isActive ? "bg-primary/10 text-primary" : "hover:bg-accent")
        }
        style={padding}
      >
        <File className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}

function FileView({ file }: { file: VertexFileResponse }) {
  const isMarkdown =
    file.path.toLowerCase().endsWith(".md") ||
    file.path.toLowerCase().endsWith(".markdown");
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-1 border-b pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            {file.path}
          </Badge>
          {file.truncated && (
            <Badge variant="secondary" className="text-[10px]">
              truncated
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </span>
        </div>
      </header>
      {isMarkdown ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{file.content}</ReactMarkdown>
        </div>
      ) : (
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
          <code>{file.content}</code>
        </pre>
      )}
    </article>
  );
}

function Hero({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Badge variant="outline">v2.0</Badge>
        <h2 className="text-lg font-medium">{title}</h2>
        {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      </CardContent>
    </Card>
  );
}
