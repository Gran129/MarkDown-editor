import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { fileNameOf } from "@/lib/note-format";
import {
  officeAppLabel,
  type OfficeKind,
  type OfficePreviewKind,
  downloadOfficeCopy,
  readOfficeArrayBuffer,
} from "@/lib/office";
import { openPath } from "@/lib/tauri-api";

interface OfficePreviewProps {
  candidates: string[];
  kind: OfficeKind;
  previewKind: OfficePreviewKind | null;
  target: string;
}

interface ViewerHandle {
  destroy: () => void;
  fitWidth?: () => void | Promise<void>;
  relayout?: () => void | Promise<void>;
}

interface PageState {
  index: number;
  total: number;
}

async function loadViewerAddons() {
  const [{ math }, { threeD }, { regionMap }] = await Promise.all([
    import("@silurus/ooxml/math"),
    import("@silurus/ooxml/three-d"),
    import("@silurus/ooxml/region-map"),
  ]);
  return {
    math,
    threeD,
    regionMap,
    mode: "main" as const,
    useGoogleFonts: true,
  };
}

async function readFirstExisting(paths: string[]): Promise<{ path: string; data: ArrayBuffer }> {
  let lastError: unknown;
  for (const path of paths) {
    try {
      const data = await readOfficeArrayBuffer(path);
      return { path, data };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("未找到该 Office 文件");
}

function extensionHint(kind: OfficeKind): string {
  switch (kind) {
    case "word":
      return "doc";
    case "excel":
      return "xls";
    case "powerpoint":
      return "ppt";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function OfficePreview({ candidates, kind, previewKind, target }: OfficePreviewProps) {
  const appLabel = officeAppLabel(kind);
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const xlsxRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const navRef = useRef<{
    prev?: () => Promise<void> | void;
    next?: () => Promise<void> | void;
  }>({});
  const candidateKey = candidates.join("|");
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const [page, setPage] = useState<PageState>({ index: 0, total: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const holder: { viewer: ViewerHandle | null } = { viewer: null };
    viewerRef.current = null;
    navRef.current = {};
    setStatus("loading");
    setErrorMessage(null);
    setResolvedPath(null);
    setPage({ index: 0, total: 0 });

    void (async () => {
      const paths = candidateKey.length > 0 ? candidateKey.split("|") : [];
      if (paths.length === 0) {
        if (!cancelled) setStatus("missing");
        return;
      }
      let loaded: { path: string; data: ArrayBuffer };
      try {
        loaded = await readFirstExisting(paths);
      } catch {
        if (!cancelled) setStatus("missing");
        return;
      }
      if (cancelled) return;
      setResolvedPath(loaded.path);

      if (!previewKind) {
        setStatus("ready");
        return;
      }

      try {
        const addons = await loadViewerAddons();
        if (cancelled) return;

        if (previewKind === "xlsx") {
          const host = xlsxRef.current;
          if (!host) throw new Error("表格预览容器未就绪");
          host.replaceChildren();
          const { XlsxViewer } = await import("@silurus/ooxml/xlsx");
          const viewer = new XlsxViewer(host, {
            ...addons,
            enableElementSelection: true,
            showZoomSlider: true,
            resizable: true,
            onReady: (sheetNames) => {
              if (!cancelled) setPage({ index: 0, total: sheetNames.length });
            },
            onSheetChange: (index, total) => {
              if (!cancelled) setPage({ index, total });
            },
            onError: (err) => {
              if (!cancelled) {
                setStatus("error");
                setErrorMessage(err.message);
              }
            },
          });
          holder.viewer = viewer;
          viewerRef.current = viewer;
          await viewer.load(loaded.data);
          if (cancelled) {
            viewer.destroy();
            return;
          }
          await viewer.relayout();
          navRef.current = {
            prev: () => viewer.prevSheet(),
            next: () => viewer.nextSheet(),
          };
          setPage({ index: viewer.sheetIndex, total: viewer.sheetCount });
          setStatus("ready");
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) throw new Error("预览画布未就绪");
        const width = Math.max(hostRef.current?.clientWidth ?? 720, 320);

        if (previewKind === "docx") {
          const { DocxViewer } = await import("@silurus/ooxml/docx");
          const viewer = new DocxViewer(canvas, {
            ...addons,
            width,
            enableTextSelection: true,
            enableElementSelection: true,
            onPageChange: (index, total) => {
              if (!cancelled) setPage({ index, total });
            },
            onError: (err) => {
              if (!cancelled) {
                setStatus("error");
                setErrorMessage(err.message);
              }
            },
          });
          holder.viewer = viewer;
          viewerRef.current = viewer;
          await viewer.load(loaded.data);
          if (cancelled) {
            viewer.destroy();
            return;
          }
          await viewer.fitWidth();
          navRef.current = {
            prev: () => viewer.prevPage(),
            next: () => viewer.nextPage(),
          };
          setPage({ index: viewer.currentPage, total: viewer.pageCount });
          setStatus("ready");
          return;
        }

        const { PptxViewer } = await import("@silurus/ooxml/pptx");
        const viewer = new PptxViewer(canvas, {
          ...addons,
          width,
          enableTextSelection: true,
          enableElementSelection: true,
          enableMediaPlayback: true,
          hiddenSlideMode: "show",
          onSlideChange: (index, total) => {
            if (!cancelled) setPage({ index, total });
          },
          onError: (err) => {
            if (!cancelled) {
              setStatus("error");
              setErrorMessage(err.message);
            }
          },
        });
        holder.viewer = viewer;
        viewerRef.current = viewer;
        await viewer.load(loaded.data);
        if (cancelled) {
          viewer.destroy();
          return;
        }
        await viewer.fitWidth();
        navRef.current = {
          prev: () => viewer.prevSlide(),
          next: () => viewer.nextSlide(),
        };
        setPage({ index: viewer.slideIndex, total: viewer.slideCount });
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "预览失败");
      }
    })();

    return () => {
      cancelled = true;
      holder.viewer?.destroy();
      holder.viewer = null;
      viewerRef.current = null;
    };
  }, [candidateKey, previewKind]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || status !== "ready") return;
    const observer = new ResizeObserver(() => {
      void viewerRef.current?.fitWidth?.();
      void viewerRef.current?.relayout?.();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [status, resolvedPath]);

  const absPath = resolvedPath ?? candidates[0] ?? null;
  const displayName = fileNameOf(target);

  const stopNodeSelect = (event: MouseEvent | PointerEvent) => {
    event.stopPropagation();
  };

  const handleOpen = async () => {
    if (!absPath) return;
    setBusy(true);
    try {
      await openPath(absPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `无法用 ${appLabel} 打开`);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!absPath) return;
    setBusy(true);
    try {
      await downloadOfficeCopy(absPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "下载失败");
    } finally {
      setBusy(false);
    }
  };

  const pageLabel = (() => {
    if (!previewKind || page.total < 1) return null;
    switch (previewKind) {
      case "docx":
        return `第 ${page.index + 1} / ${page.total} 页`;
      case "xlsx":
        return `工作表 ${page.index + 1} / ${page.total}`;
      case "pptx":
        return `第 ${page.index + 1} / ${page.total} 张`;
      default: {
        const _exhaustive: never = previewKind;
        return _exhaustive;
      }
    }
  })();

  return (
    <span className="embed-office" data-office="true" data-office-kind={kind}>
      <span className="embed-office-chrome">
        <span className="embed-office-title">
          <FileSpreadsheet className="embed-office-icon" aria-hidden />
          <span>
            {displayName}
            <span className="embed-office-app"> · {appLabel} 预览</span>
          </span>
        </span>
        <span className="embed-office-actions" onMouseDown={stopNodeSelect} onClick={stopNodeSelect}>
          {previewKind && page.total > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="上一页"
                disabled={busy || page.index <= 0}
                onClick={() => void navRef.current.prev?.()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="embed-office-page">{pageLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="下一页"
                disabled={busy || page.index >= page.total - 1}
                onClick={() => void navRef.current.next?.()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {previewKind && page.total <= 1 && pageLabel && (
            <span className="embed-office-page">{pageLabel}</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !absPath || status === "missing"}
            onClick={() => void handleOpen()}
            title={`用 ${appLabel} 打开并编辑原文件`}
          >
            <ExternalLink className="h-4 w-4" />
            用 {appLabel} 编辑
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !absPath || status === "missing"}
            onClick={() => void handleDownload()}
            title="下载原始文件副本"
          >
            <Download className="h-4 w-4" />
            下载
          </Button>
        </span>
      </span>

      {status === "missing" && (
        <span className="embed-office-fallback">未找到该 {appLabel} 文件</span>
      )}
      {status === "error" && (
        <span className="embed-office-fallback">
          预览失败{errorMessage ? `：${errorMessage}` : ""}。仍可用 {appLabel} 打开原文件编辑。
        </span>
      )}
      {!previewKind && status !== "missing" && (
        <span className="embed-office-fallback">
          旧版 .{extensionHint(kind)} 无法在笔记内还原全部版式。请用 {appLabel} 打开以编辑并查看原始效果。
        </span>
      )}

      <span
        ref={hostRef}
        className={previewKind === "xlsx" ? "embed-office-xlsx" : "embed-office-canvas-wrap"}
        onMouseDown={stopNodeSelect}
        onPointerDown={stopNodeSelect}
        onClick={stopNodeSelect}
        hidden={!previewKind || status === "missing"}
      >
        {previewKind === "xlsx" ? (
          <div ref={xlsxRef} className="embed-office-xlsx-host" />
        ) : (
          <canvas ref={canvasRef} className="embed-office-canvas" />
        )}
      </span>
      {status === "loading" && previewKind && (
        <span className="embed-office-fallback">正在还原 {appLabel} 版式…</span>
      )}
    </span>
  );
}
