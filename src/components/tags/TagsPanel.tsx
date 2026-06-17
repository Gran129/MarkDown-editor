import { useMemo } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { extractTags } from "@/lib/markdown";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export function TagsPanel() {
  const tabs = useAppStore((s) => s.tabs);
  const fileTree = useAppStore((s) => s.fileTree);
  const tagFilter = useAppStore((s) => s.tagFilter);
  const setTagFilter = useAppStore((s) => s.setTagFilter);
  const openFile = useAppStore((s) => s.openFile);

  const tagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tab of tabs) {
      const tags = extractTags(tab.content, tab.frontmatter);
      for (const tag of tags) {
        const paths = map.get(tag) ?? [];
        paths.push(tab.path);
        map.set(tag, paths);
      }
    }
    return map;
  }, [tabs]);

  const allTags = [...tagMap.keys()].sort();

  return (
    <ScrollArea className="h-full p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">标签</h3>
      {allTags.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无标签</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={cn(
                "rounded-full px-2 py-0.5 text-xs transition-colors",
                tagFilter === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            >
              #{tag}
              <span className="ml-1 opacity-60">{tagMap.get(tag)?.length ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      {tagFilter && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-muted-foreground">筛选: #{tagFilter}</p>
          <ul className="space-y-1">
            {(tagMap.get(tagFilter) ?? []).map((path) => (
              <li key={path}>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => void openFile(path)}
                >
                  {path.split(/[/\\]/).pop()}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!allTags.length && fileTree.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">打开更多笔记以收集标签</p>
      )}
    </ScrollArea>
  );
}
