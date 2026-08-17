import { Copy, Trash2, Undo2 } from "lucide-react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";

export function BlockReferenceView({ node, editor, getPos }: NodeViewProps) {
  const setSelectedBlockRef = useEditorStore((s) => s.setSelectedBlockRef);
  const viewMode = useAppStore((s) => s.viewMode);
  const sourceFile = (node.attrs.sourceFile as string) || "";
  const blockId = (node.attrs.blockId as string) || "";
  const sync = Boolean(node.attrs.sync);
  const role = node.attrs.role === "child" ? "child" : "parent";
  const editing = viewMode === "editing";

  const run = (command: () => boolean) => {
    const pos = getPos();
    if (typeof pos === "number") {
      editor.chain().focus().setTextSelection(pos + 1).run();
    }
    command();
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn("block-reference", role === "child" && "is-child")}
      data-block-ref="true"
      data-source-file={sourceFile}
      data-block-id={blockId}
      data-sync={sync ? "true" : "false"}
      data-role={role}
    >
      <div
        className={cn(
          "block-reference-label",
          "flex select-none flex-wrap items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground",
        )}
        data-block-ref-label="true"
        contentEditable={false}
        onMouseDown={(event) => {
          event.preventDefault();
          setSelectedBlockRef({ sourceFile, blockId, sync, nodePos: null });
        }}
      >
        <span>{role === "child" ? "子级同步区块" : "父级同步区块"}</span>
        {editing && (
          <span className="ml-auto flex items-center gap-0.5 normal-case tracking-normal">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              title="复制为子级同步区块"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(() => editor.commands.copySyncBlock())}
            >
              <Copy className="mr-1 h-3 w-3" />
              复制
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              title="转为普通区块，去掉同步样式"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(() => editor.commands.unwrapSyncBlock())}
            >
              <Undo2 className="mr-1 h-3 w-3" />
              转为普通
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-destructive hover:text-destructive"
              title="删除此区块及其中内容"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(() => editor.commands.deleteSyncBlock())}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              删除
            </Button>
          </span>
        )}
      </div>
      <NodeViewContent className="block-reference-body" />
    </NodeViewWrapper>
  );
}
