import { Copy, ExternalLink, Link2, RefreshCw, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";

export function BlockRefPanel() {
  const selectedBlockRef = useEditorStore((s) => s.selectedBlockRef);
  const setSelectedBlockRef = useEditorStore((s) => s.setSelectedBlockRef);
  const setBlockReferenceSync = useEditorStore((s) => s.setBlockReferenceSync);
  const jumpToBlockSource = useEditorStore((s) => s.jumpToBlockSource);
  const editor = useEditorStore((s) => s.editor);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const viewMode = useAppStore((s) => s.viewMode);

  if (!selectedBlockRef) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
        <Link2 className="mb-2 h-8 w-8 opacity-40" />
        <p>点击文档中的同步区块标题，可复制子级、转为普通或删除</p>
      </div>
    );
  }

  const { sourceFile, blockId, sync } = selectedBlockRef;
  const displayFile = sourceFile || "当前文件";

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div>
        <h3 className="text-sm font-semibold">同步区块</h3>
        <p className="mt-1 text-xs text-muted-foreground">父级可复制出无限子级，最多嵌套三层</p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">来源文件</span>
          <p className="break-all font-medium">{displayFile}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">板块 ID</span>
          <p className="font-mono text-xs">{blockId}</p>
        </div>
      </div>

      <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${viewMode === "reading" ? "cursor-default opacity-60" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={sync}
          disabled={viewMode === "reading"}
          onChange={(e) => setBlockReferenceSync(e.target.checked)}
          className="rounded"
        />
        <span>
          <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
          同步源板块内容
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        开启后，同一 ID 的父级与子级会互相更新。
      </p>

      {viewMode === "editing" && editor && (
        <div className="grid grid-cols-1 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => editor.commands.copySyncBlock()}
          >
            <Copy className="mr-2 h-4 w-4" />
            复制为子级
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              editor.commands.unwrapSyncBlock();
              setSelectedBlockRef(null);
            }}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            转为普通区块
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              editor.commands.deleteSyncBlock();
              setSelectedBlockRef(null);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除区块及内容
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant="default"
        size="sm"
        className="w-full"
        disabled={!vaultPath}
        onClick={() => void jumpToBlockSource()}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        跳转到来源板块
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setSelectedBlockRef(null)}
      >
        关闭
      </Button>
    </div>
  );
}
