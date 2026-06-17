import type { Node as PMNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";

import {
  buildParagraphStyle,
  formatBlockComment,
  parseBlockComment,
  stripBlockComment,
  type ParagraphBlockMeta,
} from "@/lib/block-utils";

const BLOCK_REF_LINE_RE =
  /^⟦block-ref\s+file="([^"]*)"\s+id="([^"]*)"\s+sync="([01])"(?:\s+text="([^"]*)")?⟧$/;
const BLOCK_REF_END_RE = /^⟦\/block-ref⟧$/;

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function preprocessBlockRefs(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const match = lines[i]!.match(BLOCK_REF_LINE_RE);
    if (!match) {
      out.push(lines[i]!);
      i++;
      continue;
    }

    const [, file, blockId, sync, snapshotText] = match;
    const body: string[] = [];
    i++;
    if (sync === "0") {
      while (i < lines.length && !BLOCK_REF_END_RE.test(lines[i]!)) {
        body.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
    }

    const content = snapshotText
      ? decodeURIComponent(snapshotText)
      : body.join("\n");
    const inner = content
      ? `<p>${escapeAttr(content).replace(/\n/g, "<br/>")}</p>`
      : "<p></p>";

    out.push(
      `<div data-block-ref="true" data-source-file="${escapeAttr(file!)}" data-block-id="${escapeAttr(blockId!)}" data-sync="${sync === "1" ? "true" : "false"}" class="block-reference">${inner}</div>`,
    );
  }

  return out.join("\n");
}

export function preprocessParagraphBlocks(md: string): string {
  const lines = md.split("\n");
  return lines
    .map((line) => {
      const { text, meta } = stripBlockComment(line);
      if (Object.keys(meta).length === 0) return line;

      const style = buildParagraphStyle(meta);
      const attrs: string[] = [];
      if (meta.blockId) attrs.push(`data-block-id="${meta.blockId}"`);
      if (style) attrs.push(`style="${style}"`);
      if (meta.textIndent) attrs.push(`data-text-indent="${meta.textIndent}"`);
      if (meta.marginLeft) attrs.push(`data-margin-left="${meta.marginLeft}"`);
      if (meta.marginBefore) attrs.push(`data-margin-before="${meta.marginBefore}"`);
      if (meta.marginAfter) attrs.push(`data-margin-after="${meta.marginAfter}"`);
      if (meta.paragraphLineHeight)
        attrs.push(`data-line-height="${meta.paragraphLineHeight}"`);

      if (attrs.length === 0) return text;
      return `<p ${attrs.join(" ")}>${text || "<br/>"}</p>`;
    })
    .join("\n");
}

function paragraphMetaFromNode(node: PMNode): ParagraphBlockMeta {
  return {
    blockId: (node.attrs.blockId as string | null) ?? null,
    textIndent: (node.attrs.textIndent as string | null) ?? null,
    marginLeft: (node.attrs.marginLeft as string | null) ?? null,
    marginBefore: (node.attrs.marginBefore as string | null) ?? null,
    marginAfter: (node.attrs.marginAfter as string | null) ?? null,
    paragraphLineHeight: (node.attrs.paragraphLineHeight as string | null) ?? null,
  };
}

export function syncParagraphBlocksInMarkdown(editor: Editor, markdown: string): string {
  const paragraphs: { text: string; meta: ParagraphBlockMeta }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "paragraph") return;
    if (node.textContent.length === 0 && !node.attrs.blockId) return;
    paragraphs.push({ text: node.textContent, meta: paragraphMetaFromNode(node) });
  });

  if (paragraphs.length === 0) return markdown;

  let index = 0;
  const lines = markdown.split("\n");
  const out = lines.map((line) => {
    if (!line.trim() || line.startsWith("#") || line.startsWith("|") || line.startsWith(">")) {
      return line;
    }
    if (line.startsWith("```") || line.includes("data-block-ref")) return line;
    if (line.match(/^⟦block-ref/)) return line;

    const para = paragraphs[index];
    index++;
    if (!para) return line;

    const comment = formatBlockComment(para.meta);
    if (!comment) return line;
    const base = para.text || line.replace(/<!--\s*mded-block:[^>]+-->/, "").trim();
    return `${base}${comment}`;
  });

  return out.join("\n");
}

export function postprocessBlockRefs(md: string): string {
  return md.replace(
    /<div[^>]*data-block-ref="true"[^>]*data-source-file="([^"]*)"[^>]*data-block-id="([^"]*)"[^>]*data-sync="(true|false)"[^>]*>([\s\S]*?)<\/div>/gi,
    (_, file: string, blockId: string, sync: string, inner: string) => {
      if (sync === "true") {
        return `⟦block-ref file="${file}" id="${blockId}" sync="1"⟧`;
      }
      const text = inner
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      return `⟦block-ref file="${file}" id="${blockId}" sync="0"⟧\n${text}\n⟦/block-ref⟧`;
    },
  );
}

export function parseBlockRefLine(line: string) {
  return line.match(BLOCK_REF_LINE_RE);
}

export { parseBlockComment, stripBlockComment };
