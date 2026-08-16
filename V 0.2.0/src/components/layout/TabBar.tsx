import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-10 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border/80 bg-muted/40 px-1.5">
      {tabs.map((tab) => {
        const active = activeTabPath === tab.path;
        return (
          <div
            key={tab.path}
            className={cn(
              "group relative flex max-w-[220px] min-w-[96px] cursor-pointer items-start gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs transition-colors",
              active
                ? "border-border bg-background text-foreground shadow-[0_-1px_2px_rgba(0,0,0,0.04)]"
                : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
            onClick={() => setActiveTab(tab.path)}
          >
            {active && (
              <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
            )}
            {tab.isDirty && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="未保存" />
            )}
            <span className="min-w-0 flex-1 break-words leading-snug [overflow-wrap:anywhere] line-clamp-2">
              {tab.title}
            </span>
            <button
              type="button"
              className={cn(
                "ml-0.5 shrink-0 rounded-sm p-0.5 hover:bg-accent",
                active ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
              title="关闭标签"
              aria-label={`关闭 ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.path);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
