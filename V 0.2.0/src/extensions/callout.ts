import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes: { type: string; title?: string }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",

  addAttributes() {
    return {
      type: { default: "note" },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.type as string;
    const title = (node.attrs.title as string) || type.charAt(0).toUpperCase() + type.slice(1);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-callout": type,
        "data-title": title,
        class: `callout callout-${type}`,
      }),
      ["div", { class: "callout-title", "data-callout-title": "" }, title],
      ["div", { class: "callout-content", "data-callout-content": "" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { type: attributes.type, title: attributes.title },
            content: [{ type: "paragraph" }],
          }),
    };
  },
});
