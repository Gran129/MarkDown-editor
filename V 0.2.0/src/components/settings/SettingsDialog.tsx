import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/stores/app-store";
import { getAppEditionInfo } from "@/lib/tauri-api";
import type { AppEditionInfo } from "@/lib/types";

function EditionBadge({ info }: { info: AppEditionInfo | null }) {
  if (!info) return null;

  const editionLabel =
    info.edition === "portable" ? "便携版本地版" : "安装包联网版";
  const networkLabel = info.networkOnline ? "在线" : "离线";

  return (
    <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
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
  const vaultPath = useAppStore((s) => s.vaultPath);
  const sourceVaultPath = useAppStore((s) => s.sourceVaultPath);
  const [editionInfo, setEditionInfo] = useState<AppEditionInfo | null>(null);
  const [tab, setTab] = useState("general");
  const lineHeight = settings.line_height ?? 1.75;

  useEffect(() => {
    if (!open) return;
    void getAppEditionInfo().then(setEditionInfo);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setSettingsOpen}>
      <DialogContent
        className="flex max-h-[85vh] min-h-[28rem] max-w-lg flex-col gap-0 overflow-hidden p-0"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="relative z-10 mx-6 mt-3 grid w-auto shrink-0 grid-cols-2">
            <TabsTrigger value="general" className="min-w-[4.5rem]">常规</TabsTrigger>
            <TabsTrigger value="editor" className="min-w-[4.5rem]">编辑</TabsTrigger>
          </TabsList>
          <TabsContent
            value="general"
            forceMount
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden"
          >
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
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="rounded"
                checked={settings.auto_save_enabled}
                onChange={(e) =>
                  void updateSettings({ auto_save_enabled: e.target.checked })
                }
              />
              启用自动保存
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              关闭后仅在点击保存或 Ctrl+S 时写入文件，可避免编辑被覆盖。
            </p>
            <label className="mt-3 block text-sm font-medium">自动保存间隔（分钟）</label>
            <Input
              type="number"
              className="mt-1"
              min={1}
              max={60}
              disabled={!settings.auto_save_enabled}
              value={settings.auto_save_minutes}
              onChange={(e) =>
                void updateSettings({ auto_save_minutes: Number(e.target.value) })
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
          <div>
            <label className="text-sm font-medium">Daily Notes 模板</label>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="# {{date}}"
              value={settings.daily_notes_template}
              onChange={(e) =>
                void updateSettings({ daily_notes_template: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              仅在新建当日笔记时使用；已存在的日记会直接打开。
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 rounded"
              checked={Boolean(settings.default_vault)}
              disabled={!vaultPath && !settings.default_vault}
              onChange={(e) => {
                void updateSettings({
                  default_vault: e.target.checked
                    ? (sourceVaultPath ?? vaultPath ?? settings.default_vault)
                    : null,
                });
              }}
            />
            <span>
              启动时自动打开上次 Vault
              {settings.default_vault ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {settings.default_vault}
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  需先打开一个 Vault 后再勾选
                </span>
              )}
            </span>
          </label>
          </TabsContent>
          <TabsContent value="editor" forceMount className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden">
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">代码块</p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={settings.code_inline_on_selection}
                  onChange={(e) =>
                    void updateSettings({ code_inline_on_selection: e.target.checked })
                  }
                />
                <span>
                  段落中代码块
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    打开后，选中段落里的部分文字再点代码块，只把选中文字标成行内代码，而不是整段变成代码块。
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={settings.code_merge_paragraphs}
                  onChange={(e) =>
                    void updateSettings({ code_merge_paragraphs: e.target.checked })
                  }
                />
                <span>
                  多段落合并为一个代码块
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    打开后，选中多个段落再启用代码块，会合并成一个代码块并保留原来的换行，语法高亮仍然可用。
                  </span>
                </span>
              </label>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function HelpDialog() {
  const open = useAppStore((s) => s.helpOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);

  const shortcuts = [
    ["Ctrl+S", "保存到项目工作文件夹（明文 Markdown）"],
    ["Ctrl+Shift+E", "从项目文件夹导出（Markdown 或加密 .mdte）"],
    ["Ctrl+O", "快速切换"],
    ["Ctrl+H", "查找与替换（编辑视图）"],
    ["Ctrl+Shift+F", "全文搜索"],
    ["Ctrl+/", "快捷键帮助"],
    ["Ctrl+Alt+1", "语法视图（Markdown 源码）"],
    ["Ctrl+Alt+2", "阅读视图（只读）"],
    ["Ctrl+Alt+3", "编辑视图（Word 式）"],
    ["Ctrl+Alt+\\", "循环切换视图"],
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
              <tr key={key} className="border-b border-border/70 last:border-0">
                <td className="py-2 pr-3 align-middle">
                  <kbd className="app-kbd whitespace-nowrap">{key}</kbd>
                </td>
                <td className="py-2 text-muted-foreground">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
