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

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            closeBlock: (n: unknown) => void;
            ensureNewLine: () => void;
            text: (s: string, escape?: boolean) => void;
          },
          node: { textContent: string; attrs: { language?: string | null } },
        ) {
          const lang = node.attrs.language && node.attrs.language !== "plaintext" ? node.attrs.language : "";
          state.write("```" + lang + "\n");
          state.text(node.textContent, false);
          state.ensureNewLine();
          state.write("```");
          state.closeBlock(node);
        },
      },
    };
  },
});
