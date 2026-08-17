import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";

export function BlockReferenceView({ node }: NodeViewProps) {
  const setSelectedBlockRef = useEditorStore((s) => s.setSelectedBlockRef);
  const sourceFile = (node.attrs.sourceFile as string) || "";
  const blockId = (node.attrs.blockId as string) || "";
  const sync = Boolean(node.attrs.sync);

  return (
    <NodeViewWrapper
      as="div"
      className="block-reference"
      data-block-ref="true"
      data-source-file={sourceFile}
      data-block-id={blockId}
      data-sync={sync ? "true" : "false"}
    >
      <div
        className={cn(
          "block-reference-label",
          "select-none text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground",
        )}
        data-block-ref-label="true"
        contentEditable={false}
        onMouseDown={(event) => {
          event.preventDefault();
          setSelectedBlockRef({ sourceFile, blockId, sync, nodePos: null });
        }}
      >
        同步板块
      </div>
      <NodeViewContent className="block-reference-body" />
    </NodeViewWrapper>
  );
}
