import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Merge,
  PaintBucket,
  Split,
  Trash2,
} from "lucide-react";
import { BubbleMenu } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TableColAlign } from "@/extensions/table-extended";
import { splitMergedCellKeepContent } from "@/lib/table-split";

interface TableMenuProps {
  editor: Editor | null;
}

function TableMenuButton({
  onClick,
  active,
  title,
  children,
  className,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", active && "bg-accent", className)}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

function DeleteRowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="1.5" y="3" width="13" height="4" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="13" height="4" rx="0.8" fill="currentColor" opacity="0.22" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 11.1 11 11.1M8 8.2v5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DeleteColumnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="3" y="1.5" width="4" height="13" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="4" height="13" rx="0.8" fill="currentColor" opacity="0.22" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 5.2v5.6M8.2 8h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const BG_PRESETS = [
  { label: "无", value: null },
  { label: "浅黄", value: "#fef9c3" },
  { label: "浅绿", value: "#dcfce7" },
  { label: "浅蓝", value: "#dbeafe" },
  { label: "浅灰", value: "#f3f4f6" },
];

export function TableMenu({ editor }: TableMenuProps) {
  if (!editor) return null;

  const setAlign = (align: TableColAlign) => {
    editor.chain().focus().setCellAttribute("colAlign", align).run();
  };

  const setBg = (color: string | null) => {
    editor.chain().focus().setCellAttribute("backgroundColor", color).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: "top" }}
      shouldShow={({ editor: ed }) => ed.isActive("table")}
      className="flex max-w-[min(96vw,720px)] flex-wrap items-center gap-0.5 rounded-lg border bg-background p-1 shadow-md"
    >
      <span className="px-1.5 text-xs font-medium text-muted-foreground">表格</span>
      <div className="mx-0.5 h-5 w-px bg-border" />

      <TableMenuButton
        onClick={() => editor.chain().focus().addRowBefore().run()}
        title="在上方插入行"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </TableMenuButton>
      <TableMenuButton
        onClick={() => editor.chain().focus().addRowAfter().run()}
        title="在下方插入行"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </TableMenuButton>
      <TableMenuButton
        onClick={() => editor.chain().focus().deleteRow().run()}
        title="删除当前行"
        className="text-destructive hover:text-destructive"
      >
        <DeleteRowIcon className="h-3.5 w-3.5" />
      </TableMenuButton>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <TableMenuButton
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        title="在左侧插入列"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </TableMenuButton>
      <TableMenuButton
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        title="在右侧插入列"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </TableMenuButton>
      <TableMenuButton
        onClick={() => editor.chain().focus().deleteColumn().run()}
        title="删除当前列"
        className="text-destructive hover:text-destructive"
      >
        <DeleteColumnIcon className="h-3.5 w-3.5" />
      </TableMenuButton>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <TableMenuButton
        onClick={() => editor.chain().focus().mergeCells().run()}
        title="合并单元格"
      >
        <Merge className="h-3.5 w-3.5" />
      </TableMenuButton>
      <TableMenuButton
        onClick={() => splitMergedCellKeepContent(editor)}
        title="拆分单元格（保留合并后的内容）"
      >
        <Split className="h-3.5 w-3.5" />
      </TableMenuButton>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <div className="flex flex-col items-center gap-0.5 px-1">
        <span className="text-[10px] leading-none text-muted-foreground">对齐</span>
        <div className="flex items-center gap-0.5">
          <TableMenuButton onClick={() => setAlign("left")} title="左对齐">
            <AlignLeft className="h-3.5 w-3.5" />
          </TableMenuButton>
          <TableMenuButton onClick={() => setAlign("center")} title="居中对齐">
            <AlignCenter className="h-3.5 w-3.5" />
          </TableMenuButton>
          <TableMenuButton onClick={() => setAlign("right")} title="右对齐">
            <AlignRight className="h-3.5 w-3.5" />
          </TableMenuButton>
        </div>
      </div>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {BG_PRESETS.map((preset) => (
        <TableMenuButton
          key={preset.label}
          onClick={() => setBg(preset.value)}
          title={preset.value ? `背景色：${preset.label}` : "清除背景色"}
          className={preset.value ? "relative" : undefined}
        >
          {preset.value ? (
            <span
              className="h-3.5 w-3.5 rounded-sm border border-border"
              style={{ backgroundColor: preset.value }}
            />
          ) : (
            <PaintBucket className="h-3.5 w-3.5" />
          )}
        </TableMenuButton>
      ))}

      <div className="mx-0.5 h-5 w-px bg-border" />

      <TableMenuButton
        onClick={() => editor.chain().focus().deleteTable().run()}
        title="删除整个表格"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </TableMenuButton>
    </BubbleMenu>
  );
}
