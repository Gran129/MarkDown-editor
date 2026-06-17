import type { Editor } from "@tiptap/core";

import { extractBlockTextFromMarkdown } from "@/lib/block-utils";
import { readFile } from "@/lib/tauri-api";

/** 刷新文档中开启同步的板块引用内容 */
export async function refreshSyncedBlockReferences(
  editor: Editor,
  currentFilePath: string,
  getTabContent: (path: string) => string | undefined,
): Promise<void> {
  const pending: { sourceFile: string; blockId: string; pos: number }[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockReference") return;
    if (!node.attrs.sync) return;
    pending.push({
      sourceFile: (node.attrs.sourceFile as string) || currentFilePath,
      blockId: node.attrs.blockId as string,
      pos,
    });
  });

  if (pending.length === 0) return;

  const contentCache = new Map<string, string>();

  for (const item of pending) {
    let md = contentCache.get(item.sourceFile);
    if (md === undefined) {
      const fromTab = getTabContent(item.sourceFile);
      if (fromTab !== undefined) md = fromTab;
      else {
        try {
          md = await readFile(item.sourceFile);
        } catch {
          md = "";
        }
      }
      contentCache.set(item.sourceFile, md);
    }

    const text = extractBlockTextFromMarkdown(md, item.blockId);
    if (text === null) continue;

    const node = editor.state.doc.nodeAt(item.pos);
    if (!node || node.firstChild?.textContent === text) continue;

    const innerPos = item.pos + 1;
    const innerNode = node.firstChild;
    if (!innerNode) continue;

    editor
      .chain()
      .command(({ tr, state }) => {
        tr.replaceWith(
          innerPos,
          innerPos + innerNode.nodeSize,
          state.schema.nodes.paragraph!.create(
            null,
            text ? state.schema.text(text) : null,
          ),
        );
        return true;
      })
      .run();
  }
}

/** 源板块变更时，更新同文件内的同步引用 */
export function refreshSameFileBlockReferences(
  editor: Editor,
  blockId: string,
  newText: string,
): void {
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockReference") return;
    if (!node.attrs.sync) return;
    if (node.attrs.blockId !== blockId) return;

    const innerPos = pos + 1;
    const innerNode = node.firstChild;
    if (!innerNode || innerNode.textContent === newText) return;

    editor
      .chain()
      .command(({ tr, state }) => {
        tr.replaceWith(
          innerPos,
          innerPos + innerNode.nodeSize,
          state.schema.nodes.paragraph!.create(
            null,
            newText ? state.schema.text(newText) : null,
          ),
        );
        return true;
      })
      .run();
  });
}
