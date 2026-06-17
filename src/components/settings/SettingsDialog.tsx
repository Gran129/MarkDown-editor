import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";

export function SettingsDialog() {
  const open = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <Dialog open={open} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <div>
            <label className="text-sm font-medium">编辑器字号</label>
            <Input
              type="number"
              className="mt-1"
              value={settings.font_size}
              onChange={(e) =>
                void updateSettings({ font_size: Number(e.target.value) })
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
    ["Ctrl+Shift+F", "全文搜索"],
    ["Ctrl+/", "快捷键帮助"],
    ["Ctrl+B", "加粗"],
    ["Ctrl+I", "斜体"],
    ["Ctrl+K", "插入链接"],
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
