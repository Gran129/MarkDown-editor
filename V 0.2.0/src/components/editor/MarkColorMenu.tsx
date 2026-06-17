import type { Editor } from "@tiptap/react";
import { Palette } from "lucide-react";

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
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 rounded-r-none ${active ? "bg-accent" : ""}`}
          onClick={onToggle}
          title={title}
          aria-label={title}
        >
          {icon}
        </Button>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-4 rounded-l-none px-0"
            title={`${title} — 选择颜色`}
            aria-label={`${title}颜色`}
          >
            <Palette className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuLabel className="text-xs">颜色</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MARK_COLOR_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => {
              if (!editor.isActive(mark === "underline" ? "underline" : mark)) {
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
