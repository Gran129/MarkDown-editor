import { Node, mergeAttributes } from "@tiptap/core";

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
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      sourceFile: { default: "" },
      blockId: { default: "" },
      sync: { default: true },
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
