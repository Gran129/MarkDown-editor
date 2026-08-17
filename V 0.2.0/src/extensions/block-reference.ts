import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { BlockReferenceView } from "@/components/editor/BlockReferenceView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockReference: {
      insertBlockReference: (attrs: {
        sourceFile: string;
        blockId: string;
        sync?: boolean;
        content?: string;
      }) => ReturnType;
      setBlockReferenceSync: (sync: boolean) => ReturnType;
    };
  }
}

export const BlockReference = Node.create({
  name: "blockReference",
  group: "block",
  content: "paragraph+",
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
      insertBlockReference:
        ({ sourceFile, blockId, sync = true, content = "" }) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: { sourceFile, blockId, sync },
              content: [
                {
                  type: "paragraph",
                  content: content ? [{ type: "text", text: content }] : [],
                },
              ],
            })
            .run(),

      setBlockReferenceSync:
        (sync) =>
        ({ chain }) =>
          chain().focus().updateAttributes(this.name, { sync }).run(),
    };
  },
});
