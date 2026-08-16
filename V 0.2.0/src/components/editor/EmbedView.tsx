import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ChevronDown, ChevronUp, Trash2, ChevronsUpDown } from "lucide-react";
import { OfficePreview } from "@/components/editor/OfficePreview";
import { PdfPreview } from "@/components/editor/PdfPreview";
import { XmindEditor } from "@/components/editor/XmindEditor";
import { Button } from "@/components/ui/button";
import { parseFrontmatter } from "@/lib/markdown";
import { resolveLinkTarget } from "@/lib/link-attrs";
import { resolveNoteMediaFile, stripNoteExtension, fileNameOf } from "@/lib/note-format";
import { openableKindFromPath } from "@/lib/file-kinds";
import {
  isOfficeFileName,
  officeKindFromPath,
  officeLookupPaths,
  officePreviewKind,
} from "@/lib/office";
import { readFile, resolveNotePath } from "@/lib/tauri-api";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

function toDisplaySrc(filePath: string): string {
  if (/^https?:\/\//i.test(filePath)) return filePath;
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}

function moveEmbed(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"], dir: -1 | 1) {
  const pos = getPos();
  if (typeof pos !== "number") return;
  const $pos = editor.state.doc.resolve(pos);
  const index = $pos.index();
  const parent = $pos.parent;
  const next = index + dir;
  if (next < 0 || next >= parent.childCount) return;
  const current = parent.child(index);
  const other = parent.child(next);
  const start = pos;
  const otherStart = dir === -1 ? pos - other.nodeSize : pos + current.nodeSize;
  const tr = editor.state.tr;
  if (dir === -1) {
    tr.delete(start, start + current.nodeSize);
    tr.insert(otherStart, current);
  } else {
    tr.delete(otherStart, otherStart + other.nodeSize);
    tr.insert(start, other);
  }
  editor.view.dispatch(tr);
}

export function EmbedView({
  node,
  deleteNode,
  getPos,
  editor,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const target = resolveLinkTarget(node.attrs.target);
  const size = typeof node.attrs.size === "string" ? node.attrs.size : null;
  const collapsed = Boolean(node.attrs.collapsed);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const notePath = useAppStore((s) => s.activeTabPath);
  const viewMode = useAppStore((s) => s.viewMode);
  const isImage = IMAGE_EXT.test(target);
  const officeKind = officeKindFromPath(target);
  const isOffice = isOfficeFileName(target);
  const kind = openableKindFromPath(target);
  const resolved = resolveNoteMediaFile(notePath, vaultPath, target);
  const [notePreview, setNotePreview] = useState<string | null>(null);
  const [noteMissing, setNoteMissing] = useState(false);

  useEffect(() => {
    if (!target || isImage || isOffice || kind === "pdf" || kind === "xmind" || !vaultPath) {
      setNotePreview(null);
      setNoteMissing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const path = await resolveNotePath(vaultPath, stripNoteExtension(target));
      if (cancelled) return;
      if (!path) {
        setNoteMissing(true);
        setNotePreview(null);
        return;
      }
      try {
        const raw = await readFile(path);
        const { body } = parseFrontmatter(raw);
        const excerpt = body.trim().slice(0, 400);
        setNoteMissing(false);
        setNotePreview(excerpt || "（空笔记）");
      } catch {
        setNoteMissing(true);
        setNotePreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, isImage, isOffice, kind, vaultPath]);

  const chrome = target ? (
    <div className="embed-block-chrome" contentEditable={false}>
      <span className="min-w-0 truncate text-xs">{fileNameOf(target)}</span>
      <span className="ml-auto flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="上移"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => moveEmbed(editor, getPos, -1)}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="下移"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => moveEmbed(editor, getPos, 1)}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title={collapsed ? "展开预览" : "收起预览"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => updateAttributes({ collapsed: !collapsed })}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          title="移除预览"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => deleteNode()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </span>
    </div>
  ) : null;

  if (!target) {
    return (
      <NodeViewWrapper as="div" className="embed" data-embed="true" data-target="">
        ![[]]
      </NodeViewWrapper>
    );
  }

  const selectedClass = selected ? "is-embed-selected" : "";

  if (isImage) {
    const src = toDisplaySrc(resolved);
    return (
      <NodeViewWrapper
        as="div"
        className={cn("embed embed-image", selectedClass)}
        data-embed="true"
        data-target={target}
        data-size={size ?? undefined}
        id={`embed-${fileNameOf(target)}`}
      >
        {chrome}
        {!collapsed && <img src={src} alt={target} style={size ? { maxWidth: size } : undefined} />}
      </NodeViewWrapper>
    );
  }

  if (isOffice && officeKind) {
    return (
      <NodeViewWrapper
        as="div"
        className={cn("embed embed-office-node", selectedClass)}
        data-embed="true"
        data-target={target}
        data-office="true"
        id={`embed-${fileNameOf(target)}`}
      >
        {chrome}
        {!collapsed && (
          <OfficePreview
            target={target}
            kind={officeKind}
            previewKind={officePreviewKind(target)}
            candidates={officeLookupPaths(notePath, vaultPath, target)}
          />
        )}
      </NodeViewWrapper>
    );
  }

  if (kind === "pdf") {
    return (
      <NodeViewWrapper
        as="div"
        className={cn("embed embed-media-node", selectedClass)}
        data-embed="true"
        data-target={target}
        id={`embed-${fileNameOf(target)}`}
      >
        {chrome}
        {!collapsed && <PdfPreview path={resolved} editable={viewMode === "editing"} />}
      </NodeViewWrapper>
    );
  }

  if (kind === "xmind") {
    return (
      <NodeViewWrapper
        as="div"
        className={cn("embed embed-media-node", selectedClass)}
        data-embed="true"
        data-target={target}
        id={`embed-${fileNameOf(target)}`}
      >
        {chrome}
        {!collapsed && (
          <XmindEditor path={resolved} readOnly={viewMode !== "editing"} compact />
        )}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className={cn("embed embed-note", selectedClass)}
      data-embed="true"
      data-target={target}
      id={`embed-${fileNameOf(target)}`}
    >
      {chrome}
      <span className="embed-note-title">![[{target}]]</span>
      {!collapsed &&
        (noteMissing ? (
          <span className="embed-note-missing">未找到该笔记</span>
        ) : notePreview ? (
          <span className="embed-note-body">{notePreview}</span>
        ) : (
          <span className="embed-note-body">加载嵌入内容…</span>
        ))}
    </NodeViewWrapper>
  );
}
