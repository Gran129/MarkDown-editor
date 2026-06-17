import type { Editor } from "@tiptap/react";
import { open } from "@tauri-apps/plugin-dialog";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MARK_COLOR_PRESETS } from "@/extensions/markdown-marks";

interface CodeBlockColorMenuProps {
  editor: Editor;
}

export function CodeBlockColorMenu({ editor }: CodeBlockColorMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
          代码块颜色
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-xs">背景色</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MARK_COLOR_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() =>
              editor
                .chain()
                .focus()
                .updateAttributes("codeBlock", { blockColor: preset.value })
                .run()
            }
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export async function pickLocalImagePath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "图片",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"],
      },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}
