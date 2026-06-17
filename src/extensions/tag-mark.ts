import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tagMark: {
      setTag: (tag: string) => ReturnType;
      toggleTag: (tag: string) => ReturnType;
    };
  }
}

export const TagMark = Mark.create({
  name: "tagMark",

  addAttributes() {
    return {
      tag: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-tag": "true",
        class: "tag-mark",
      }),
      `#${HTMLAttributes.tag}`,
    ];
  },

  addCommands() {
    return {
      setTag:
        (tag) =>
        ({ commands }) =>
          commands.setMark(this.name, { tag }),
      toggleTag:
        (tag) =>
        ({ commands }) =>
          commands.toggleMark(this.name, { tag }),
    };
  },
});
