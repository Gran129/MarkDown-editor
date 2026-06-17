import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DownloadProgress, UpdateCheckResult } from "@/lib/types";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: UpdateCheckResult | null;
  progress: DownloadProgress | null;
  installingOnExit: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UpdateDialog({
  open,
  onOpenChange,
  info,
  progress,
  installingOnExit,
  onConfirm,
  onCancel,
}: UpdateDialogProps) {
  if (!info) return null;

  const downloading = progress !== null && !progress.ready && !progress.error;
  const ready = progress?.ready ?? false;
  const failed = Boolean(progress?.error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>发现新版本</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            当前版本：<strong>{info.currentVersion}</strong>
          </p>
          <p>
            最新版本：<strong>{info.latestVersion}</strong>
          </p>

          {info.releaseNotes ? (
            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-3 whitespace-pre-wrap text-muted-foreground">
              {info.releaseNotes}
            </div>
          ) : null}

          {downloading ? (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
              <p className="text-muted-foreground">正在后台下载更新包… {progress?.percent ?? 0}%</p>
            </div>
          ) : null}

          {ready && !installingOnExit ? (
            <p className="text-muted-foreground">更新包已就绪，确认后将在您关闭应用时自动安装。</p>
          ) : null}

          {installingOnExit ? (
            <p className="font-medium text-primary">
              已安排更新：关闭应用后将自动安装新版本。
            </p>
          ) : null}

          {failed ? (
            <p className="text-destructive">{progress?.error ?? "下载失败"}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          {!installingOnExit ? (
            <Button variant="outline" onClick={onCancel} disabled={downloading}>
              稍后
            </Button>
          ) : null}
          {!installingOnExit ? (
            <Button onClick={onConfirm} disabled={downloading && !failed}>
              {ready ? "确认并关闭时安装" : failed ? "重试下载" : "立即更新"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              知道了
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
