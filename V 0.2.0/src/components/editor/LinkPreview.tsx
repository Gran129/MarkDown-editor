import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ExternalLink } from "lucide-react";

interface LinkPreviewProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLElement | null>;
  onInternalNavigate?: (href: string) => void;
}

interface PreviewState {
  href: string;
  text: string;
  x: number;
  y: number;
}

export function LinkPreview({ editor, containerRef, onInternalNavigate }: LinkPreviewProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !editor) return;

    const show = (anchor: HTMLAnchorElement) => {
      const rect = anchor.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setPreview({
        href: anchor.getAttribute("href") ?? "",
        text: anchor.textContent ?? "",
        x: rect.left - rootRect.left,
        y: rect.bottom - rootRect.top + 4,
      });
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !root.contains(anchor)) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      show(anchor);
    };

    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest(".link-preview-card")) return;
      hideTimer.current = setTimeout(() => setPreview(null), 200);
    };

    const onClick = (e: MouseEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !root.contains(anchor)) return;
      e.preventDefault();
      const href = anchor.getAttribute("href") ?? "";
      if (/^https?:\/\//i.test(href)) {
        void import("@tauri-apps/plugin-shell").then(({ open }) => open(href));
      } else if (onInternalNavigate) {
        onInternalNavigate(href);
      }
    };

    root.addEventListener("mouseover", onMouseOver);
    root.addEventListener("mouseout", onMouseOut);
    root.addEventListener("click", onClick, true);

    return () => {
      root.removeEventListener("mouseover", onMouseOver);
      root.removeEventListener("mouseout", onMouseOut);
      root.removeEventListener("click", onClick, true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [editor, containerRef, onInternalNavigate]);

  if (!preview) return null;

  const isExternal = /^https?:\/\//i.test(preview.href);

  return (
    <div
      className="link-preview-card pointer-events-auto absolute z-50 w-64 rounded-lg border bg-popover p-3 text-sm shadow-lg"
      style={{ left: preview.x, top: preview.y }}
      onMouseEnter={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      }}
      onMouseLeave={() => setPreview(null)}
    >
      <p className="line-clamp-2 font-medium">{preview.text || preview.href}</p>
      <p className="mt-1 break-all text-xs text-muted-foreground">{preview.href}</p>
      <p className="mt-2 flex items-center gap-1 text-xs text-primary">
        <ExternalLink className="h-3 w-3" />
        {isExternal ? "Ctrl+点击 在浏览器打开" : "Ctrl+点击 跳转"}
      </p>
    </div>
  );
}
