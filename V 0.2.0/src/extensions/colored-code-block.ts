import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";

export const ColoredCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockColor: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-block-color"),
        renderHTML: (attrs: { blockColor: string | null }) =>
          attrs.blockColor
            ? {
                "data-block-color": attrs.blockColor,
                style: `background-color:${attrs.blockColor}`,
              }
            : {},
      },
    };
  },
});
