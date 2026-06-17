import { ListTree } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { extractHeadings } from "@/lib/markdown-transform";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";

export function OutlinePanel() {
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const tabs = useAppStore((s) => s.tabs);
  const scrollToHeading = useEditorStore((s) => s.scrollToHeading);

  const activeTab = tabs.find((t) => t.path === activeTabPath);
  const headings = activeTab ? extractHeadings(activeTab.content) : [];

  if (!activeTab) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        未打开笔记
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
        <ListTree className="h-8 w-8 opacity-40" />
        <p>当前笔记无标题</p>
        <p className="text-xs">使用 # 至 ###### 创建大纲</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {headings.map((h, i) => (
          <button
            key={`${h.id}-${i}`}
            type="button"
            className={cn(
              "block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent",
              h.level === 1 && "font-semibold",
              h.level === 2 && "pl-4",
              h.level === 3 && "pl-6 text-muted-foreground",
              h.level >= 4 && "pl-8 text-xs text-muted-foreground",
            )}
            onClick={() => scrollToHeading(h.text)}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
