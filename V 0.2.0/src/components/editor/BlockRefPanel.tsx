import { ExternalLink, Link2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";

export function BlockRefPanel() {
  const selectedBlockRef = useEditorStore((s) => s.selectedBlockRef);
  const setSelectedBlockRef = useEditorStore((s) => s.setSelectedBlockRef);
  const setBlockReferenceSync = useEditorStore((s) => s.setBlockReferenceSync);
  const jumpToBlockSource = useEditorStore((s) => s.jumpToBlockSource);
  const vaultPath = useAppStore((s) => s.vaultPath);

  if (!selectedBlockRef) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
        <Link2 className="mb-2 h-8 w-8 opacity-40" />
        <p>点击文档中的「板块引用」查看来源与同步设置</p>
      </div>
    );
  }

  const { sourceFile, blockId, sync } = selectedBlockRef;
  const displayFile = sourceFile || "当前文件";

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div>
        <h3 className="text-sm font-semibold">板块引用</h3>
        <p className="mt-1 text-xs text-muted-foreground">借鉴 Notion 的同步引用块</p>
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

      <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={sync}
          onChange={(e) => setBlockReferenceSync(e.target.checked)}
          className="rounded"
        />
        <span>
          <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
          同步源板块内容
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        开启后，源板块修改会自动更新此引用；可随时在此切换。
      </p>

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
