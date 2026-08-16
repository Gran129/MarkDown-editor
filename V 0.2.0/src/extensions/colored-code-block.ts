import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { CodeBlockView } from "@/components/editor/CodeBlockView";

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

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
