import { useCallback, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 侧栏宽度限制（像素）：可在 min ~ max 之间连续拖拽 */
export const SIDEBAR_WIDTH_LIMITS = {
  left: { min: 160, max: 520, default: 240 },
  right: { min: 180, max: 560, default: 256 },
} as const;

function clampWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ResizableSidebarProps {
  side: "left" | "right";
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
  onResizeEnd?: (width: number) => void;
  className?: string;
  children: ReactNode;
}

export function ResizableSidebar({
  side,
  width,
  minWidth,
  maxWidth,
  onWidthChange,
  onResizeEnd,
  className,
  children,
}: ResizableSidebarProps) {
  const startRef = useRef({ x: 0, width: 0 });

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      startRef.current = { x: event.clientX, width };

      const handleMouseMove = (e: MouseEvent) => {
        const delta =
          side === "left" ? e.clientX - startRef.current.x : startRef.current.x - e.clientX;
        onWidthChange(clampWidth(startRef.current.width + delta, minWidth, maxWidth));
      };

      const handleMouseUp = (e: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const delta =
          side === "left" ? e.clientX - startRef.current.x : startRef.current.x - e.clientX;
        onResizeEnd?.(clampWidth(startRef.current.width + delta, minWidth, maxWidth));
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [side, minWidth, maxWidth, onWidthChange, onResizeEnd],
  );

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      aria-label={side === "left" ? "调整左侧栏宽度" : "调整右侧栏宽度"}
      onMouseDown={handleMouseDown}
      className={cn(
        "group relative z-20 flex w-1 shrink-0 touch-none select-none",
        side === "left" ? "order-2" : "order-1",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 w-2 cursor-col-resize",
          side === "left" ? "-right-0.5" : "-left-0.5",
        )}
      />
      <div className="mx-auto w-px bg-border transition-colors group-hover:bg-primary/60 group-active:bg-primary" />
    </div>
  );

  return (
    <div className={cn("flex h-full shrink-0", className)}>
      {side === "right" && handle}
      <aside
        className={cn("h-full shrink-0 overflow-hidden", side === "left" ? "order-1" : "order-2")}
        style={{ width }}
      >
        {children}
      </aside>
      {side === "left" && handle}
    </div>
  );
}

export function loadSidebarWidths(): { left: number; right: number } {
  const { left, right } = SIDEBAR_WIDTH_LIMITS;
  try {
    const raw = localStorage.getItem("markdown-editor-sidebar-widths");
    if (!raw) {
      return { left: left.default, right: right.default };
    }
    const parsed = JSON.parse(raw) as { left?: number; right?: number };
    return {
      left: clampWidth(parsed.left ?? left.default, left.min, left.max),
      right: clampWidth(parsed.right ?? right.default, right.min, right.max),
    };
  } catch {
    return { left: left.default, right: right.default };
  }
}

export function saveSidebarWidths(left: number, right: number): void {
  const { left: leftLimits, right: rightLimits } = SIDEBAR_WIDTH_LIMITS;
  localStorage.setItem(
    "markdown-editor-sidebar-widths",
    JSON.stringify({
      left: clampWidth(left, leftLimits.min, leftLimits.max),
      right: clampWidth(right, rightLimits.min, rightLimits.max),
    }),
  );
}
