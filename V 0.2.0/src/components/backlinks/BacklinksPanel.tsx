import { useEffect, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { getBacklinks, resolveNotePath, createFile } from "@/lib/tauri-api";
import { extractWikiLinks } from "@/lib/markdown";
import { isBrokenLinkValue } from "@/lib/link-attrs";
import type { BacklinkResult } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";

/** 合并「反链 + 出链」面板：两者方向相反，不是同一概念 */
export function LinksPanel() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.path === s.activeTabPath));
  const openFile = useAppStore((s) => s.openFile);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const [backlinks, setBacklinks] = useState<BacklinkResult[]>([]);

  useEffect(() => {
    if (!vaultPath || !activeTab) {
      setBacklinks([]);
      return;
    }
    void getBacklinks(vaultPath, activeTab.title).then(setBacklinks);
  }, [vaultPath, activeTab?.path, activeTab?.title, activeTab]);

  if (!activeTab) {
    return <EmptyPanel message="打开笔记以查看链接关系" />;
  }

  const outgoing = extractWikiLinks(activeTab.content).filter((link) => !isBrokenLinkValue(link));

  const openWikiTarget = async (link: string) => {
    if (!vaultPath) return;
    const path = await resolveNotePath(vaultPath, link);
    if (path) {
      await openFile(path);
    } else if (window.confirm(`笔记「${link}」不存在，是否创建？`)) {
      const newPath = `${vaultPath}/${link}.md`;
      await createFile(newPath, `# ${link}\n`);
      await refreshFileTree();
      await openFile(newPath);
    }
  };

  return (
    <ScrollArea className="h-full p-3">
      <section className="mb-4">
        <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">反链</h3>
        <p className="mb-2 text-xs text-muted-foreground">其他笔记中指向本篇的链接</p>
        {backlinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无反链</p>
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
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{bl.context}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">出链</h3>
        <p className="mb-2 text-xs text-muted-foreground">本篇正文中链接到的其他笔记</p>
        {outgoing.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无出链</p>
        ) : (
          <ul className="space-y-1">
            {outgoing.map((link) => (
              <li key={link}>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => void openWikiTarget(link)}
                >
                  [[{link}]]
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ScrollArea>
  );
}

/** @deprecated 使用 LinksPanel */
export const BacklinksPanel = LinksPanel;

/** @deprecated 使用 LinksPanel */
export const OutgoingLinksPanel = LinksPanel;

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
