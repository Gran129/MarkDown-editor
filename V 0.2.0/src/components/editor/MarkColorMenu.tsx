import type { Editor } from "@tiptap/react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MARK_COLOR_PRESETS,
  type ColoredMarkName,
} from "@/extensions/markdown-marks";
import { cn } from "@/lib/utils";

interface MarkColorMenuProps {
  editor: Editor;
  mark: ColoredMarkName;
  title: string;
  active?: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
}

function applyMarkColor(editor: Editor, mark: ColoredMarkName, color: string | null) {
  const chain = editor.chain().focus();
  if (mark === "underline") {
    if (color) chain.setMark("underline", { color }).run();
    else chain.toggleUnderline().run();
    return;
  }
  if (mark === "strike") {
    if (editor.isActive("strike")) {
      chain.setMark("strike", { color }).run();
    } else {
      chain.toggleStrike().run();
      if (color) chain.setMark("strike", { color }).run();
    }
    return;
  }
  if (mark === "highlight") {
    if (editor.isActive("highlight")) {
      chain.setMark("highlight", { color }).run();
    } else {
      chain.toggleHighlight().run();
      if (color) chain.setMark("highlight", { color }).run();
    }
    return;
  }
  if (mark === "code") {
    if (editor.isActive("code")) {
      chain.setMark("code", { color }).run();
    } else {
      chain.toggleCode().run();
      if (color) chain.setMark("code", { color }).run();
    }
  }
}

export function MarkColorMenu({
  editor,
  mark,
  title,
  active,
  onToggle,
  icon,
}: MarkColorMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-8 w-9 rounded-md", active && "bg-primary/10 text-primary")}
          title={`${title}（点击选择颜色或开关）`}
          aria-label={title}
        >
          {icon}
          <ChevronDown className="ml-0.5 h-2.5 w-2.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel className="text-xs">{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggle}>{active ? `取消${title}` : `应用${title}`}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">颜色</DropdownMenuLabel>
        {MARK_COLOR_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => {
              if (!editor.isActive(mark)) {
                onToggle();
              }
              applyMarkColor(editor, mark, preset.value);
            }}
          >
            {preset.value ? (
              <span
                className="mr-2 inline-block h-3 w-3 rounded-sm border border-border"
                style={{ backgroundColor: preset.value }}
              />
            ) : (
              <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-dashed border-border" />
            )}
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
