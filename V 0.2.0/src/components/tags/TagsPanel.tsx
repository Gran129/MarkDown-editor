import { useMemo } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export function TagsPanel() {
  const vaultTags = useAppStore((s) => s.vaultTags);
  const tagFilter = useAppStore((s) => s.tagFilter);
  const setTagFilter = useAppStore((s) => s.setTagFilter);
  const openFile = useAppStore((s) => s.openFile);
  const vaultPath = useAppStore((s) => s.vaultPath);

  const allTags = useMemo(
    () => [...vaultTags].sort((a, b) => a.tag.localeCompare(b.tag)),
    [vaultTags],
  );

  const filteredPaths = vaultTags.find((entry) => entry.tag === tagFilter)?.paths ?? [];

  if (!vaultPath) {
    return (
      <ScrollArea className="h-full p-3">
        <p className="text-sm text-muted-foreground">打开 Vault 后显示标签</p>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">标签</h3>
      {allTags.length === 0 ? (
        <p className="text-sm text-muted-foreground">当前知识库中还没有标签。在笔记中使用 #tag 或 frontmatter tags。</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(({ tag, paths }) => (
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
              <span className="ml-1 opacity-60">{paths.length}</span>
            </button>
          ))}
        </div>
      )}
      {tagFilter && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-muted-foreground">筛选: #{tagFilter}</p>
          {filteredPaths.length === 0 ? (
            <p className="text-xs text-muted-foreground">没有匹配的笔记</p>
          ) : (
            <ul className="space-y-1">
              {filteredPaths.map((path) => (
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
          )}
        </div>
      )}
    </ScrollArea>
  );
}
