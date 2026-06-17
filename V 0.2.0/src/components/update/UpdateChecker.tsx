import { useCallback, useEffect, useRef, useState } from "react";

import { UpdateDialog } from "@/components/update/UpdateDialog";
import {
  checkForUpdates,
  confirmUpdateInstall,
  getUpdateDownloadProgress,
  startUpdateDownload,
} from "@/lib/tauri-api";
import type { DownloadProgress, UpdateCheckResult } from "@/lib/types";

export function UpdateChecker() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<UpdateCheckResult | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [installingOnExit, setInstallingOnExit] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      void getUpdateDownloadProgress().then(setProgress);
    }, 500);
  }, [stopPolling]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await checkForUpdates();

        // 便携版本地版 / 离线安装版：不弹更新窗口
        if (
          result.status === "skipped_portable" ||
          result.status === "skipped_offline" ||
          !result.updateEnabled
        ) {
          return;
        }

        if (result.status === "update_available") {
          setInfo(result);
          setOpen(true);
        }
      } catch {
        // 静默忽略
      }
    })();

    return stopPolling;
  }, [stopPolling]);

  const handleConfirm = async () => {
    if (!info) return;

    if (progress?.ready && !installingOnExit) {
      await confirmUpdateInstall();
      setInstallingOnExit(true);
      stopPolling();
      return;
    }

    try {
      await startUpdateDownload(info.downloadUrl);
      setProgress({ percent: 0, ready: false });
      startPolling();
    } catch {
      setProgress({ percent: 0, ready: false, error: "无法开始下载更新包" });
    }
  };

  const handleCancel = () => {
    stopPolling();
    setOpen(false);
  };

  if (!info?.updateEnabled) {
    return null;
  }

  return (
    <UpdateDialog
      open={open}
      onOpenChange={setOpen}
      info={info}
      progress={progress}
      installingOnExit={installingOnExit}
      onConfirm={() => void handleConfirm()}
      onCancel={handleCancel}
    />
  );
}
