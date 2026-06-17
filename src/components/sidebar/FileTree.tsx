import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/lib/types";
import {
  createFile,
  createFolder,
  deletePath,
  movePath,
  renamePath,
  revealInExplorer,
  updateWikiLinksOnRename,
} from "@/lib/tauri-api";
import { useAppStore } from "@/stores/app-store";

interface FileTreeProps {
  nodes: FileNode[];
  vaultPath: string;
  depth?: number;
}

function FileTreeNode({ node, vaultPath, depth = 0 }: { node: FileNode; vaultPath: string; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const openFile = useAppStore((s) => s.openFile);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const tagFilter = useAppStore((s) => s.tagFilter);

  const isDir = node.is_dir;
  const isActive = activeTabPath === node.path;

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      void openFile(node.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const action = window.prompt(
      "操作: new-note | new-folder | rename | delete | reveal",
    );
    void handleAction(action);
  };

  const handleAction = async (action: string | null) => {
    if (!action) return;
    switch (action) {
      case "new-note": {
        const name = window.prompt("笔记名称（不含 .md）");
        if (!name) return;
        const base = isDir ? node.path : node.path.replace(/[/\\][^/\\]+$/, "");
        await createFile(`${base}/${name}.md`, "# " + name + "\n");
        await refreshFileTree();
        break;
      }
      case "new-folder": {
        const name = window.prompt("文件夹名称");
        if (!name) return;
        const base = isDir ? node.path : node.path.replace(/[/\\][^/\\]+$/, "");
        await createFolder(`${base}/${name}`);
        await refreshFileTree();
        break;
      }
      case "rename": {
        const newName = window.prompt("新名称", node.name);
        if (!newName || newName === node.name) return;
        const newPath = node.path.replace(/[/\\][^/\\]+$/, `/${newName}${isDir ? "" : node.name.endsWith(".md") && !newName.endsWith(".md") ? ".md" : ""}`);
        const oldName = node.name.replace(/\.md$/i, "");
        const newNoteName = newName.replace(/\.md$/i, "");
        await renamePath(node.path, newPath);
        if (!isDir && oldName !== newNoteName) {
          await updateWikiLinksOnRename(vaultPath, oldName, newNoteName);
        }
        await refreshFileTree();
        break;
      }
      case "delete": {
        if (window.confirm(`确定删除 ${node.name}？`)) {
          await deletePath(node.path);
          await refreshFileTree();
        }
        break;
      }
      case "reveal":
        await revealInExplorer(node.path);
        break;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.path);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDir) return;
    const source = e.dataTransfer.getData("text/plain");
    if (source && source !== node.path) {
      const fileName = source.split(/[/\\]/).pop()!;
      await movePath(source, `${node.path}/${fileName}`);
      await refreshFileTree();
    }
  };

  if (tagFilter && !isDir) {
    // Tag filter applied at parent level via search - show all for now
  }

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => void handleDrop(e)}
        onContextMenu={handleContextMenu}
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-sm hover:bg-accent",
          isActive && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        {isDir ? (
          expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-primary" />
          )
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {isDir && expanded && node.children && (
        <FileTree nodes={node.children} vaultPath={vaultPath} depth={depth + 1} />
      )}
    </div>
  );
}

export function FileTree({ nodes, vaultPath, depth = 0 }: FileTreeProps) {
  return (
    <ScrollArea className="h-full">
      <div className="py-1">
        {nodes.map((node) => (
          <FileTreeNode key={node.path} node={node} vaultPath={vaultPath} depth={depth} />
        ))}
      </div>
    </ScrollArea>
  );
}

export function FileTreeSidebar() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const fileTree = useAppStore((s) => s.fileTree);
  const openVault = useAppStore((s) => s.openVault);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);

  const handleNewNote = async () => {
    if (!vaultPath) return;
    const name = window.prompt("笔记名称");
    if (!name) return;
    await createFile(`${vaultPath}/${name}.md`, `# ${name}\n`);
    await refreshFileTree();
  };

  if (!vaultPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
        <p>尚未打开 Vault</p>
        <Button size="sm" onClick={() => void openVault()}>
          打开 Vault
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          文件
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void handleNewNote()} title="新建笔记">
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void refreshFileTree()} title="刷新">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <FileTree nodes={fileTree} vaultPath={vaultPath} />
      </div>
    </div>
  );
}
