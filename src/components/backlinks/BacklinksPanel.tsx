import { useEffect, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { getBacklinks, resolveNotePath, createFile } from "@/lib/tauri-api";
import { extractWikiLinks } from "@/lib/markdown";
import type { BacklinkResult } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";

export function BacklinksPanel() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.path === s.activeTabPath));
  const openFile = useAppStore((s) => s.openFile);
  const [backlinks, setBacklinks] = useState<BacklinkResult[]>([]);

  useEffect(() => {
    if (!vaultPath || !activeTab) {
      setBacklinks([]);
      return;
    }
    const noteName = activeTab.title;
    void getBacklinks(vaultPath, noteName).then(setBacklinks);
  }, [vaultPath, activeTab?.path, activeTab?.title, activeTab]);

  if (!activeTab) {
    return <EmptyPanel message="打开笔记以查看反向链接" />;
  }

  return (
    <ScrollArea className="h-full p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">反向链接</h3>
      {backlinks.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无反向链接</p>
      ) : (
        <ul className="space-y-2">
          {backlinks.map((bl) => (
            <li key={bl.source_path}>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => void openFile(bl.source_path)}
              >
                {bl.source_title}
              </button>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{bl.context}</p>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}

export function OutgoingLinksPanel() {
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.path === s.activeTabPath));
  const openFile = useAppStore((s) => s.openFile);
  const vaultPath = useAppStore((s) => s.vaultPath);

  if (!activeTab) {
    return <EmptyPanel message="打开笔记以查看出链" />;
  }

  const links = extractWikiLinks(activeTab.content);

  return (
    <ScrollArea className="h-full p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">出链</h3>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无出链</p>
      ) : (
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link}>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={async () => {
                  if (!vaultPath) return;
                  const path = await resolveNotePath(vaultPath, link);
                  if (path) void openFile(path);
                  else if (window.confirm(`笔记「${link}」不存在，是否创建？`)) {
                    await createFile(`${vaultPath}/${link}.md`, `# ${link}\n`);
                    void openFile(`${vaultPath}/${link}.md`);
                  }
                }}
              >
                [[{link}]]
              </button>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
