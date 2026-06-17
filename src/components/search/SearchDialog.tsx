import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchNotes } from "@/lib/tauri-api";
import type { SearchResult } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";

export function SearchDialog() {
  const open = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const openFile = useAppStore((s) => s.openFile);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!vaultPath || !query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchNotes(vaultPath, query).then(setResults);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, vaultPath]);

  return (
    <Dialog open={open} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>全文搜索</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="搜索笔记… 支持 tag:xxx path:folder/"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ScrollArea className="max-h-80">
          {results.length === 0 && query && (
            <p className="py-4 text-center text-sm text-muted-foreground">无结果</p>
          )}
          <ul className="space-y-2 py-2">
            {results.map((r) => (
              <li key={r.path}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => {
                    void openFile(r.path);
                    setSearchOpen(false);
                  }}
                >
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{r.snippet}</div>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <p className="text-xs text-muted-foreground">Ctrl+Shift+F 打开搜索</p>
      </DialogContent>
    </Dialog>
  );
}

export function QuickSwitcherDialog() {
  const open = useAppStore((s) => s.quickSwitcherOpen);
  const setQuickSwitcherOpen = useAppStore((s) => s.setQuickSwitcherOpen);
  const fileTree = useAppStore((s) => s.fileTree);
  const openFile = useAppStore((s) => s.openFile);
  const [query, setQuery] = useState("");

  const allFiles = flattenMdFiles(fileTree);

  const filtered = query
    ? allFiles.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : allFiles;

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setQuickSwitcherOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>快速切换</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="输入笔记名称…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ScrollArea className="max-h-72">
          <ul>
            {filtered.slice(0, 20).map((path) => (
              <li key={path}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    void openFile(path);
                    setQuickSwitcherOpen(false);
                  }}
                >
                  {path.split(/[/\\]/).pop()}
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <p className="text-xs text-muted-foreground">Ctrl+O 快速切换</p>
      </DialogContent>
    </Dialog>
  );
}

function flattenMdFiles(nodes: import("@/lib/types").FileNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.is_dir && node.children) {
      result.push(...flattenMdFiles(node.children));
    } else if (!node.is_dir && node.name.endsWith(".md")) {
      result.push(node.path);
    }
  }
  return result;
}
