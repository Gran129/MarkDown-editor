import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, LocateFixed, Paperclip } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { copyIntoNoteResources, listNoteResources, type ResourceFile } from "@/lib/tauri-api";
import { locateEmbedPreview, resourceIsReferenced } from "@/lib/insert-embed";
import { beginResourceDrag, endResourceDrag } from "@/lib/resource-drag";
import { isBinaryOpenable } from "@/lib/file-kinds";
import { FileTypeIcon } from "@/components/sidebar/FileTypeIcon";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const HEIGHT_KEY = "markdown-editor-resources-height";
const MIN_HEIGHT = 96;
const MAX_HEIGHT = 360;
const DEFAULT_HEIGHT = 168;

function loadHeight(): number {
  try {
    const raw = Number(localStorage.getItem(HEIGHT_KEY));
    if (Number.isFinite(raw)) return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, raw));
  } catch {
    /* ignore */
  }
  return DEFAULT_HEIGHT;
}

function saveHeight(value: number) {
  try {
    localStorage.setItem(HEIGHT_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function ResourcesPanel() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const markSelfWrite = useAppStore((s) => s.markSelfWrite);
  const activeTab = tabs.find((t) => t.path === activeTabPath);
  const noteActive = Boolean(activeTab && !isBinaryOpenable(activeTab.kind));
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [height, setHeight] = useState(loadHeight);
  const [hover, setHover] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const notePath = noteActive ? activeTabPath : null;
  const markdown = activeTab?.content ?? "";

  const refresh = useCallback(async () => {
    if (!notePath) {
      setFiles([]);
      return;
    }
    try {
      setFiles(await listNoteResources(notePath));
    } catch {
      setFiles([]);
    }
  }, [notePath]);

  useEffect(() => {
    void refresh();
  }, [refresh, markdown]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const panel = panelRef.current;
        if (!panel || !notePath) return;
        const rect = panel.getBoundingClientRect();
        const pos =
          event.payload.type === "over" ||
          event.payload.type === "drop" ||
          event.payload.type === "enter"
            ? event.payload.position
            : null;
        const inside = pos
          ? pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom
          : false;
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setHover(inside);
        } else if (event.payload.type === "leave" || event.payload.type === "drop") {
          setHover(false);
        }
        if (event.payload.type === "drop" && inside) {
          const dropped = event.payload.paths;
          void (async () => {
            markSelfWrite(2000);
            for (const source of dropped) {
              try {
                await copyIntoNoteResources(notePath, source);
              } catch {
                /* skip one file */
              }
            }
            await refresh();
          })();
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        /* dragDropEnabled may be off; HTML5 drop still works */
      });
    return () => unlisten?.();
  }, [markSelfWrite, notePath, refresh]);

  const handlePick = async () => {
    if (!notePath) return;
    const selected = await open({ multiple: true, title: "导入到笔记资源" });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    markSelfWrite(2000);
    for (const source of paths) {
      try {
        await copyIntoNoteResources(notePath, source);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "导入资源失败");
      }
    }
    await refresh();
  };

  const importOsFiles = async (fileList: FileList | File[]) => {
    if (!notePath) return;
    markSelfWrite(2000);
    for (const file of Array.from(fileList)) {
      const source = (file as File & { path?: string }).path;
      if (!source) continue;
      try {
        await copyIntoNoteResources(notePath, source);
      } catch {
        /* skip */
      }
    }
    await refresh();
  };

  const onResizeStart = (event: React.MouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startH = height;
    const onMove = (e: MouseEvent) => {
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH - (e.clientY - startY)));
      setHeight(next);
    };
    const onUp = (e: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH - (e.clientY - startY)));
      setHeight(next);
      saveHeight(next);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex shrink-0 flex-col border-t border-sidebar-border bg-sidebar">
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="调整资源栏高度"
        onMouseDown={onResizeStart}
        className="group flex h-1.5 cursor-row-resize items-center justify-center"
      >
        <div className="h-px w-8 rounded-full bg-border group-hover:bg-primary/60" />
      </div>
      <div
        ref={panelRef}
        style={{ height }}
        className={cn("flex min-h-0 flex-col", hover && "bg-primary/5")}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHover(false);
          void importOsFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center justify-between gap-1 px-2 py-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            资源
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={!noteActive}
            title="导入文件到本笔记资源"
            aria-label="导入资源"
            onClick={() => void handlePick()}
          >
            <FileUp className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {!noteActive ? (
            <p className="px-3 py-2 text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
              打开 Markdown 笔记后显示其隐藏资源文件夹
            </p>
          ) : files.length === 0 ? (
            <p className="px-3 py-2 text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
              拖拽文件到此处，或点击导入。文件会放入该笔记的隐藏 .resources 文件夹。
            </p>
          ) : (
            <ul className="space-y-0.5 px-1 pb-2">
              {files.map((file) => {
                const referenced = resourceIsReferenced(markdown, file.relative, file.name);
                return (
                  <li key={file.path}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        beginResourceDrag(file.relative);
                        e.dataTransfer.setData("text/resource-path", file.relative);
                        e.dataTransfer.setData("text/plain", file.relative);
                        e.dataTransfer.effectAllowed = "copyMove";
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDragEnd={() => endResourceDrag()}
                      className="flex cursor-grab items-start gap-1.5 rounded-md px-2 py-1 text-xs active:cursor-grabbing hover:bg-accent/70"
                      title="拖到编辑器中插入预览"
                    >
                      <FileTypeIcon name={file.name} className="mt-0.5" />
                      <span className="min-w-0 flex-1 break-words leading-snug [overflow-wrap:anywhere]">
                        {file.name}
                      </span>
                      {referenced && (
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          title="定位到笔记中的预览"
                          draggable={false}
                          onClick={() => locateEmbedPreview(file.name)}
                        >
                          <LocateFixed className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
