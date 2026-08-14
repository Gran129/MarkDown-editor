import { BookOpen, Code2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EditorViewMode } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";

const MODES: Array<{
  id: EditorViewMode;
  label: string;
  hint: string;
  icon: typeof Code2;
}> = [
  { id: "source", label: "语法", hint: "Markdown 源码 (Ctrl+Alt+1)", icon: Code2 },
  { id: "reading", label: "阅读", hint: "只读预览 (Ctrl+Alt+2)", icon: BookOpen },
  { id: "editing", label: "编辑", hint: "Word 式编辑 (Ctrl+Alt+3)", icon: Pencil },
];

export function ViewModeSwitch() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const disabled = !activeTabPath;

  return (
    <div
      role="radiogroup"
      aria-label="编辑器视图"
      className="inline-flex h-7 items-center rounded-md border border-input p-0.5"
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const selected = viewMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={mode.hint}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors",
              selected
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
              disabled && "opacity-50",
            )}
            onClick={() => setViewMode(mode.id)}
          >
            <Icon className="h-3.5 w-3.5" />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
