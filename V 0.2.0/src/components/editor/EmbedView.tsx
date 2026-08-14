import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { convertFileSrc } from "@tauri-apps/api/core";

import { parseFrontmatter } from "@/lib/markdown";
import { resolveLinkTarget } from "@/lib/link-attrs";
import { readFile, resolveNotePath } from "@/lib/tauri-api";
import { useAppStore } from "@/stores/app-store";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

function isAbsolutePath(target: string): boolean {
  return /^([a-zA-Z]:[\\/]|\/)/.test(target);
}

function resolveVaultFile(vaultPath: string | null, target: string): string {
  if (/^https?:\/\//i.test(target) || isAbsolutePath(target)) return target;
  if (!vaultPath) return target;
  return `${vaultPath}/${target}`.replace(/\\/g, "/");
}

function toDisplaySrc(filePath: string): string {
  if (/^https?:\/\//i.test(filePath)) return filePath;
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}

export function EmbedView({ node }: NodeViewProps) {
  const target = resolveLinkTarget(node.attrs.target);
  const size = typeof node.attrs.size === "string" ? node.attrs.size : null;
  const vaultPath = useAppStore((s) => s.vaultPath);
  const isImage = IMAGE_EXT.test(target);
  const [notePreview, setNotePreview] = useState<string | null>(null);
  const [noteMissing, setNoteMissing] = useState(false);

  useEffect(() => {
    if (!target || isImage || !vaultPath) {
      setNotePreview(null);
      setNoteMissing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const path = await resolveNotePath(vaultPath, target.replace(/\.md$/i, ""));
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
  }, [target, isImage, vaultPath]);

  if (!target) {
    return (
      <NodeViewWrapper as="span" className="embed" data-embed="true" data-target="">
        ![[]]
      </NodeViewWrapper>
    );
  }

  if (isImage) {
    const src = toDisplaySrc(resolveVaultFile(vaultPath, target));
    return (
      <NodeViewWrapper
        as="span"
        className="embed embed-image"
        data-embed="true"
        data-target={target}
        data-size={size ?? undefined}
      >
        <img src={src} alt={target} style={size ? { maxWidth: size } : undefined} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="embed embed-note"
      data-embed="true"
      data-target={target}
    >
      <span className="embed-note-title">![[{target}]]</span>
      {noteMissing ? (
        <span className="embed-note-missing">未找到该笔记</span>
      ) : notePreview ? (
        <span className="embed-note-body">{notePreview}</span>
      ) : (
        <span className="embed-note-body">加载嵌入内容…</span>
      )}
    </NodeViewWrapper>
  );
}
