import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Columns3,
  Merge,
  PaintBucket,
  Rows3,
  Split,
  TableProperties,
  Trash2,
} from "lucide-react";
import { BubbleMenu } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TableColAlign } from "@/extensions/table-extended";

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
      >
        <Rows3 className="h-3.5 w-3.5" />
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
      >
        <Columns3 className="h-3.5 w-3.5" />
      </TableMenuButton>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <TableMenuButton
        onClick={() => editor.chain().focus().mergeCells().run()}
        title="合并单元格"
      >
        <Merge className="h-3.5 w-3.5" />
      </TableMenuButton>
      <TableMenuButton
        onClick={() => editor.chain().focus().splitCell().run()}
        title="拆分单元格"
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
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        title="切换表头行"
      >
        <TableProperties className="h-3.5 w-3.5" />
      </TableMenuButton>
      <TableMenuButton
        onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
        title="切换表头列"
      >
        <Columns3 className="h-3.5 w-3.5 rotate-90" />
      </TableMenuButton>

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
