import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { getAppEditionInfo } from "@/lib/tauri-api";
import type { AppEditionInfo } from "@/lib/types";

function EditionBadge({ info }: { info: AppEditionInfo | null }) {
  if (!info) return null;

  const editionLabel =
    info.edition === "portable" ? "便携版本地版" : "安装包联网版";
  const networkLabel = info.networkOnline ? "在线" : "离线";

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="font-medium">{editionLabel}</div>
      <div className="mt-1 text-muted-foreground">
        版本 {info.currentVersion}
        {info.edition === "installed" ? ` · ${networkLabel}` : ""}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {info.edition === "portable"
          ? "便携版不参与更新检测，可完全离线使用。"
          : info.networkOnline
            ? "安装版将在联网时自动检查 GitHub 更新。"
            : "当前离线，已跳过更新检测；下次联网启动时将重新检查。"}
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const open = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const [editionInfo, setEditionInfo] = useState<AppEditionInfo | null>(null);
  const lineHeight = settings.line_height ?? 1.75;

  useEffect(() => {
    if (!open) return;
    void getAppEditionInfo().then(setEditionInfo);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setSettingsOpen}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <EditionBadge info={editionInfo} />
          <div>
            <label className="text-sm font-medium">主题</label>
            <div className="mt-1 flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <Button
                  key={t}
                  variant={theme === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(t)}
                >
                  {t === "light" ? "浅色" : t === "dark" ? "深色" : "跟随系统"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">阅读体验</p>
            <div>
              <label className="text-sm text-muted-foreground">编辑器字号 (px)</label>
              <Input
                type="number"
                className="mt-1 bg-background"
                min={12}
                max={28}
                value={settings.font_size}
                onChange={(e) =>
                  void updateSettings({ font_size: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <label className="text-muted-foreground">编辑器行间距</label>
                <span className="font-mono tabular-nums text-foreground">
                  {lineHeight.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                className="settings-range mt-3"
                min={1.2}
                max={2.4}
                step={0.05}
                value={lineHeight}
                onChange={(e) =>
                  void updateSettings({ line_height: Number(e.target.value) })
                }
                aria-label="编辑器行间距"
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>紧凑 1.2</span>
                <span>默认 1.75</span>
                <span>宽松 2.4</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">自动保存间隔 (ms)</label>
            <Input
              type="number"
              className="mt-1"
              value={settings.auto_save_ms}
              onChange={(e) =>
                void updateSettings({ auto_save_ms: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Daily Notes 目录</label>
            <Input
              className="mt-1"
              value={settings.daily_notes_folder}
              onChange={(e) =>
                void updateSettings({ daily_notes_folder: e.target.value })
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HelpDialog() {
  const open = useAppStore((s) => s.helpOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);

  const shortcuts = [
    ["Ctrl+S", "保存"],
    ["Ctrl+O", "快速切换"],
    ["Ctrl+H", "查找与替换"],
    ["Ctrl+Shift+F", "全文搜索"],
    ["Ctrl+/", "快捷键帮助"],
    ["Ctrl+B", "加粗"],
    ["Ctrl+I", "斜体"],
    ["Ctrl+K", "插入链接"],
    ["[[", "Wiki 链接自动补全"],
  ];

  return (
    <Dialog open={open} onOpenChange={setHelpOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {shortcuts.map(([key, desc]) => (
              <tr key={key} className="border-b border-border">
                <td className="py-1.5 font-mono text-primary">{key}</td>
                <td className="py-1.5 text-muted-foreground">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}

export function PluginsPanel() {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      <h3 className="mb-2 font-semibold text-foreground">插件系统</h3>
      <p>插件 API 已预留。后续版本将支持本地安装 .zip 插件包。</p>
      <p className="mt-2 text-xs">架构：Tauri sidecar / WASM 沙箱加载</p>
    </div>
  );
}
