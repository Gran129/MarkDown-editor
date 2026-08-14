import { useState } from "react";
import { FileLock2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { runNoteExport, type NoteExportFormat } from "@/lib/export-note";
import { stripNoteExtension } from "@/lib/note-format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const OPTIONS: Array<{
  format: NoteExportFormat;
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    format: "markdown",
    title: "仅 Markdown 文件（.md）",
    description: "明文导出当前笔记（含 YAML 属性），不含附件，不加密。可用任意编辑器打开。",
    icon: FileText,
  },
  {
    format: "encrypted",
    title: "加密格式（.mdte）",
    description:
      "导出为本软件定义的加密笔记包：正文与引用的本地资源一并打包，使用 AES-256-GCM 封装。",
    icon: FileLock2,
  },
];

export function ExportDialog() {
  const exportTargetPath = useAppStore((s) => s.exportTargetPath);
  const closeExportDialog = useAppStore((s) => s.closeExportDialog);
  const tab = useAppStore((s) => s.tabs.find((item) => item.path === s.exportTargetPath));
  const [format, setFormat] = useState<NoteExportFormat>("markdown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(exportTargetPath);
  const noteName = exportTargetPath ? stripNoteExtension(exportTargetPath) : "";

  const handleOpenChange = (next: boolean) => {
    if (!next && !busy) {
      setError(null);
      setFormat("markdown");
      closeExportDialog();
    }
  };

  const handleExport = async () => {
    if (!exportTargetPath) return;
    setBusy(true);
    setError(null);
    try {
      const dest = await runNoteExport({
        sourcePath: exportTargetPath,
        format,
        tab,
      });
      if (dest) {
        setFormat("markdown");
        closeExportDialog();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>导出笔记</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          选择导出「{noteName || "当前笔记"}」的格式。Vault 中的原文件不会被改动。
        </p>
        <div className="grid gap-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = format === option.format;
            return (
              <button
                key={option.format}
                type="button"
                disabled={busy}
                onClick={() => setFormat(option.format)}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-accent/50",
                )}
                aria-pressed={selected}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button disabled={busy || !exportTargetPath} onClick={() => void handleExport()}>
            {busy ? "正在导出…" : "选择保存位置"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
