import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { findWrapping } from "@tiptap/pm/transform";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { BlockReferenceView } from "@/components/editor/BlockReferenceView";
import { generateBlockId } from "@/lib/block-utils";

export const MAX_SYNC_NESTING = 3;
const DEFAULT_SYNC_TEXT = "这是一个同步区块，允许用户编辑该区块中的内容。";

export type SyncBlockRole = "parent" | "child";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockReference: {
      wrapSelectionAsSyncBlock: (attrs: { sourceFile: string; sync?: boolean }) => ReturnType;
      copySyncBlock: () => ReturnType;
      unwrapSyncBlock: () => ReturnType;
      deleteSyncBlock: () => ReturnType;
      setBlockReferenceSync: (sync: boolean) => ReturnType;
    };
  }
}

export function syncBlockDepthFromPos(state: EditorState, pos: number): number {
  const $pos = state.doc.resolve(Math.min(Math.max(0, pos), state.doc.content.size));
  let depth = 0;
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "blockReference") depth++;
  }
  return depth;
}

function findSyncBlock(state: EditorState): { pos: number; node: import("@tiptap/pm/model").Node } | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "blockReference") {
      return { pos: $from.before(d), node: $from.node(d) };
    }
  }
  const sel = state.selection as { node?: { type: { name: string } }; from: number };
  if (sel.node?.type.name === "blockReference") {
    const node = state.doc.nodeAt(sel.from);
    if (node) return { pos: sel.from, node };
  }
  return null;
}

/** Expand the selection to whole textblocks, avoiding the previous-paragraph boundary trap. */
export function selectedBlockRange(state: EditorState): { from: number; to: number } {
  const { $from, empty, from, to } = state.selection;
  if (empty) {
    const depth = Math.max(1, $from.depth);
    return { from: $from.before(depth), to: $from.after(depth) };
  }

  let startPos = from;
  let $start = state.doc.resolve(from);
  if ($start.parent.isTextblock && $start.parentOffset === $start.parent.content.size && from < to) {
    const next = Math.min(from + 1, state.doc.content.size);
    $start = state.doc.resolve(next);
    startPos = next;
  }
  if ($start.depth === 0) {
    $start = state.doc.resolve(Math.min(startPos + 1, state.doc.content.size));
  }
  const start = $start.before(Math.max(1, $start.depth));

  let $end = state.doc.resolve(Math.max(from, to - (to > from ? 1 : 0)));
  if ($end.depth === 0) {
    $end = state.doc.resolve(Math.max(0, to - 1));
  }
  const end = $end.after(Math.max(1, $end.depth));
  return { from: start, to: Math.max(start + 1, end) };
}

export const BlockReference = Node.create({
  name: "blockReference",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      sourceFile: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source-file") ?? "",
        renderHTML: (attributes) =>
          attributes.sourceFile ? { "data-source-file": attributes.sourceFile } : {},
      },
      blockId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-block-id") ?? "",
        renderHTML: (attributes) =>
          attributes.blockId ? { "data-block-id": attributes.blockId } : {},
      },
      sync: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-sync") !== "false",
        renderHTML: (attributes) => ({
          "data-sync": attributes.sync ? "true" : "false",
        }),
      },
      role: {
        default: "parent" as SyncBlockRole,
        parseHTML: (element) =>
          element.getAttribute("data-role") === "child" ? "child" : "parent",
        renderHTML: (attributes) => ({
          "data-role": attributes.role === "child" ? "child" : "parent",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-block-ref="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-block-ref": "true",
        class: "block-reference",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockReferenceView, { as: "div" });
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        let depth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === this.name) {
            depth = d;
            break;
          }
        }
        if (depth < 0) return false;
        if ($from.parent.type.name !== "paragraph") return false;
        if ($from.parent.textContent.length > 0) return false;

        return this.editor.commands.command(({ tr, dispatch }) => {
          const paraFrom = $from.before($from.depth);
          const paraTo = $from.after($from.depth);
          const blockTo = $from.after(depth);
          const onlyChild = $from.node(depth).childCount === 1;
          if (dispatch) {
            if (!onlyChild) tr.delete(paraFrom, paraTo);
            const insertAt = tr.mapping.map(blockTo);
            const paragraph = state.schema.nodes.paragraph!.create();
            tr.insert(insertAt, paragraph);
            tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
          }
          return true;
        });
      },
    };
  },

  addCommands() {
    return {
      wrapSelectionAsSyncBlock:
        ({ sourceFile, sync = true }) =>
        ({ state, dispatch }) => {
          const { $from, $to, empty } = state.selection;
          let $start = $from;
          if (
            !empty &&
            $from.parent.isTextblock &&
            $from.parentOffset === $from.parent.content.size &&
            $from.pos < $to.pos
          ) {
            $start = state.doc.resolve(Math.min($from.pos + 1, state.doc.content.size));
          }
          const range = $start.blockRange($to);
          if (!range) return false;
          if (syncBlockDepthFromPos(state, range.start) >= MAX_SYNC_NESTING) {
            window.alert("同步区块最多允许三层嵌套。");
            return false;
          }
          if (range.parent.type.name === this.name && range.startIndex === 0 && range.endIndex === range.parent.childCount) {
            window.alert("当前选区已是同步区块。可用「复制」创建子级。");
            return false;
          }

          const attrs = {
            sourceFile,
            blockId: generateBlockId(),
            sync,
            role: "parent" as const,
          };
          const wrapping = findWrapping(range, this.type, attrs);
          if (!wrapping) {
            window.alert("当前位置无法创建同步区块。");
            return false;
          }
          if (dispatch) {
            let tr = state.tr;
            const $block = state.doc.resolve(range.start + 1);
            if ($block.parent.isTextblock && !$block.parent.textContent.trim()) {
              tr = tr.insertText(DEFAULT_SYNC_TEXT, range.start + 1);
            }
            const mapped = tr.mapping.map(range.start);
            const mappedEnd = tr.mapping.map(range.end);
            const $mappedStart = tr.doc.resolve(mapped);
            const $mappedEnd = tr.doc.resolve(mappedEnd);
            const nextRange = $mappedStart.blockRange($mappedEnd);
            if (!nextRange) return false;
            const nextWrap = findWrapping(nextRange, this.type, attrs);
            if (!nextWrap) return false;
            tr = tr.wrap(nextRange, nextWrap);
            tr.setSelection(TextSelection.near(tr.doc.resolve(mapped + 2)));
            dispatch(tr.scrollIntoView());
          }
          return true;
        },

      copySyncBlock:
        () =>
        ({ state, dispatch }) => {
          const found = findSyncBlock(state);
          if (!found) return false;
          const copy = found.node.type.create(
            {
              ...found.node.attrs,
              role: "child",
            },
            found.node.content,
          );
          if (dispatch) {
            const insertAt = found.pos + found.node.nodeSize;
            const tr = state.tr.insert(insertAt, copy);
            tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 2)));
            dispatch(tr.scrollIntoView());
          }
          return true;
        },

      unwrapSyncBlock:
        () =>
        ({ state, dispatch }) => {
          const found = findSyncBlock(state);
          if (!found) return false;
          if (dispatch) {
            const tr = state.tr.replaceWith(
              found.pos,
              found.pos + found.node.nodeSize,
              found.node.content,
            );
            dispatch(tr.scrollIntoView());
          }
          return true;
        },

      deleteSyncBlock:
        () =>
        ({ state, dispatch }) => {
          const found = findSyncBlock(state);
          if (!found) return false;
          if (dispatch) {
            dispatch(state.tr.delete(found.pos, found.pos + found.node.nodeSize).scrollIntoView());
          }
          return true;
        },

      setBlockReferenceSync:
        (sync) =>
        ({ chain }) =>
          chain().focus().updateAttributes(this.name, { sync }).run(),
    };
  },
});
