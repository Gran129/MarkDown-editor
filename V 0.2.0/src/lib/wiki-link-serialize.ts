import type { Editor } from "@tiptap/react";

import {
  normalizeWikiLinkAttrs,
  repairBrokenWikiLinksInMarkdown,
  resolveLinkLabel,
  resolveLinkTarget,
} from "@/lib/link-attrs";

function serializeWikiLinkNode(attrs: Record<string, unknown>): string | null {
  const target = resolveLinkTarget(attrs.target, attrs.label);
  if (!target) return null;
  const label = resolveLinkLabel(attrs.target, attrs.label);
  return label !== target ? `[[${target}|${label}]]` : `[[${target}]]`;
}

/** 切换 Tab / 保存前同步修正文档中的 wikiLink 节点属性 */
export function fixWikiLinkNodesInEditor(editor: Editor): void {
  const { state, view } = editor;
  let tr = state.tr;
  let changed = false;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "wikiLink") return;
    const normalized = normalizeWikiLinkAttrs(node.attrs as Record<string, unknown>);
    if (
      node.attrs.target !== normalized.target ||
      node.attrs.label !== normalized.label
    ) {
      tr = tr.setNodeMarkup(pos, undefined, normalized);
      changed = true;
    }
  });

  if (changed) {
    view.dispatch(tr);
  }
}

export function collectWikiLinkMarkdown(editor: Editor): string[] {
  const links: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "wikiLink") return;
    const serialized = serializeWikiLinkNode(node.attrs as Record<string, unknown>);
    if (serialized) links.push(serialized);
  });
  return links;
}

export function finalizeWikiLinkMarkdown(editor: Editor, md: string): string {
  fixWikiLinkNodesInEditor(editor);
  const links = collectWikiLinkMarkdown(editor);
  return repairBrokenWikiLinksInMarkdown(md, links);
}
