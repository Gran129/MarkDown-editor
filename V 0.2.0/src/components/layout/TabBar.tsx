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
    <div className="flex h-9 shrink-0 items-end gap-0 overflow-x-auto border-b border-border bg-muted/30 px-1">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          className={cn(
            "group flex max-w-[180px] cursor-pointer items-center gap-1 rounded-t-md border border-b-0 px-3 py-1.5 text-xs",
            activeTabPath === tab.path
              ? "border-border bg-background text-foreground"
              : "border-transparent text-muted-foreground hover:bg-background/50",
          )}
          onClick={() => setActiveTab(tab.path)}
        >
          {tab.isDirty && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="未保存" />
          )}
          <span className="truncate">{tab.title}</span>
          <button
            type="button"
            className="ml-1 shrink-0 rounded opacity-0 hover:bg-accent group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.path);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
