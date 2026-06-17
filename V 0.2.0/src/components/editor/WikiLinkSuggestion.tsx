import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";

import { cn } from "@/lib/utils";

export interface WikiLinkSuggestionItem {
  id: string;
  label: string;
}

export interface WikiLinkSuggestionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const WikiLinkSuggestionList = forwardRef<
  WikiLinkSuggestionRef,
  SuggestionProps<WikiLinkSuggestionItem>
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = props.items;

  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) props.command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return (
      <div className="rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">
        无匹配笔记
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
            index === selectedIndex && "bg-accent",
          )}
          onClick={() => selectItem(index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});

WikiLinkSuggestionList.displayName = "WikiLinkSuggestionList";
