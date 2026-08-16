import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
  ExternalLink,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import {
  extensionOf,
  isNoteFileName,
  nativeNoteFileName,
  stripNoteExtension,
} from "@/lib/note-format";

interface FileTreeProps {
  nodes: FileNode[];
  vaultPath: string;
  depth?: number;
}

type PromptKind = "new-note" | "new-folder" | "rename";

interface PromptState {
  kind: PromptKind;
  defaultValue?: string;
}

function getParentPath(node: FileNode): string {
  return node.is_dir ? node.path : node.path.replace(/[/\\][^/\\]+$/, "");
}

function FileTreeNode({ node, vaultPath, depth = 0 }: { node: FileNode; vaultPath: string; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const openFile = useAppStore((s) => s.openFile);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const openExportDialog = useAppStore((s) => s.openExportDialog);

  const isDir = node.is_dir;
  const isActive = activeTabPath === node.path;

  useEffect(() => {
    if (prompt && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [prompt]);

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      void openFile(node.path);
    }
  };

  const openPrompt = (kind: PromptKind, defaultValue = "") => {
    setInputValue(defaultValue);
    setPrompt({ kind, defaultValue });
  };

  const handlePromptConfirm = async () => {
    if (!prompt) return;
    const value = inputValue.trim();
    if (!value) {
      setPrompt(null);
      return;
    }

    switch (prompt.kind) {
      case "new-note": {
        const base = getParentPath(node);
        await createFile(`${base}/${nativeNoteFileName(value)}`, `# ${value}\n`);
        break;
      }
      case "new-folder": {
        const base = getParentPath(node);
        await createFolder(`${base}/${value}`);
        break;
      }
      case "rename": {
        if (value === node.name) break;
        const suffix =
          !isDir && isNoteFileName(node.name) && !isNoteFileName(value)
            ? `.${extensionOf(node.name)}`
            : "";
        const newPath = node.path.replace(/[/\\][^/\\]+$/, `/${value}${suffix}`);
        const oldName = stripNoteExtension(node.name);
        const newNoteName = stripNoteExtension(`${value}${suffix}`);
        await renamePath(node.path, newPath);
        if (!isDir && oldName !== newNoteName) {
          await updateWikiLinksOnRename(vaultPath, oldName, newNoteName);
        }
        break;
      }
    }

    setPrompt(null);
    await refreshFileTree();
  };

  const handleDelete = async () => {
    await deletePath(node.path);
    setDeleteOpen(false);
    await refreshFileTree();
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

  const promptTitle =
    prompt?.kind === "new-note"
      ? "新建笔记"
      : prompt?.kind === "new-folder"
        ? "新建文件夹"
        : "重命名";

  const promptPlaceholder =
    prompt?.kind === "new-note"
      ? "笔记名称（不含后缀）"
      : prompt?.kind === "new-folder"
        ? "文件夹名称"
        : "新名称";

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            draggable
            onDragStart={handleDragStart}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => void handleDrop(e)}
            className={cn(
              "relative flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-sm transition-colors hover:bg-accent/70",
              isActive &&
                "bg-primary/10 font-medium text-foreground before:absolute before:inset-y-1 before:left-0.5 before:w-0.5 before:rounded-full before:bg-primary",
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => openPrompt("new-note")}>
            <FileText className="mr-2 h-4 w-4" />
            新建笔记
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => openPrompt("new-folder")}>
            <FolderPlus className="mr-2 h-4 w-4" />
            新建文件夹
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => openPrompt("rename", stripNoteExtension(node.name))}>
            <Pencil className="mr-2 h-4 w-4" />
            重命名
          </ContextMenuItem>
          {!isDir && isNoteFileName(node.name) && (
            <ContextMenuItem onSelect={() => openExportDialog(node.path)}>
              <Download className="mr-2 h-4 w-4" />
              导出…
            </ContextMenuItem>
          )}
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void revealInExplorer(node.path)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            在资源管理器中显示
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={!!prompt} onOpenChange={(open) => !open && setPrompt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{promptTitle}</DialogTitle>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={inputValue}
            placeholder={promptPlaceholder}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handlePromptConfirm();
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPrompt(null)}>
              取消
            </Button>
            <Button onClick={() => void handlePromptConfirm()}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定删除「{node.name}」？此操作无法撤销。
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isDir && expanded && node.children && (
        <FileTree nodes={node.children} vaultPath={vaultPath} depth={depth + 1} />
      )}
    </>
  );
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

function filterTreeByTag(nodes: FileNode[], matchingPaths: Set<string>): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.is_dir) {
      const children = filterTreeByTag(node.children ?? [], matchingPaths);
      if (children.length > 0) {
        result.push({ ...node, children });
      }
    } else if (matchingPaths.has(normalizePath(node.path))) {
      result.push(node);
    }
  }
  return result;
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
  const tagFilter = useAppStore((s) => s.tagFilter);
  const vaultTags = useAppStore((s) => s.vaultTags);
  const setTagFilter = useAppStore((s) => s.setTagFilter);
  const openVault = useAppStore((s) => s.openVault);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");
  const newNoteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (newNoteOpen && newNoteInputRef.current) {
      newNoteInputRef.current.focus();
    }
  }, [newNoteOpen]);

  const handleNewNote = async () => {
    if (!vaultPath) return;
    const name = newNoteName.trim();
    if (!name) return;
    await createFile(`${vaultPath}/${nativeNoteFileName(name)}`, `# ${name}\n`);
    setNewNoteOpen(false);
    setNewNoteName("");
    await refreshFileTree();
  };

  const matchingPaths = new Set(
    (vaultTags.find((entry) => entry.tag === tagFilter)?.paths ?? []).map(normalizePath),
  );
  const visibleTree = tagFilter ? filterTreeByTag(fileTree, matchingPaths) : fileTree;

  if (!vaultPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <FolderOpen className="h-9 w-9 text-primary/50" />
        <p>尚未打开 Vault</p>
        <Button size="sm" onClick={() => void openVault()}>
          打开 Vault
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-between border-b border-sidebar-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          文件
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setNewNoteName("");
              setNewNoteOpen(true);
            }}
            title="新建笔记"
            aria-label="新建笔记"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="刷新文件树"
            aria-label="刷新文件树"
            onClick={() => void refreshFileTree()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {tagFilter && (
          <div className="mx-2 mt-2 flex items-center justify-between rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-foreground">
            <span>筛选 #{tagFilter}</span>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-background/70 hover:text-foreground"
              onClick={() => setTagFilter(null)}
            >
              清除
            </button>
          </div>
        )}
        {tagFilter && visibleTree.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">没有带该标签的笔记</p>
        ) : visibleTree.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            <p>此知识库还没有笔记</p>
            <p>点击上方图标新建第一篇</p>
          </div>
        ) : (
          <FileTree nodes={visibleTree} vaultPath={vaultPath} />
        )}
      </div>

      <Dialog open={newNoteOpen} onOpenChange={setNewNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新建笔记</DialogTitle>
          </DialogHeader>
          <Input
            ref={newNoteInputRef}
            value={newNoteName}
            placeholder="笔记名称（不含后缀）"
            onChange={(e) => setNewNoteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleNewNote();
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNewNoteOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleNewNote()}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
