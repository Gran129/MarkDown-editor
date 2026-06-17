import { Node, mergeAttributes } from "@tiptap/core";
import katex from "katex";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathInline: {
      setMathInline: (attributes: { latex: string }) => ReturnType;
    };
  }
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-math-inline]",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            latex: el.getAttribute("data-math-inline") || el.textContent || "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const latex = (node.attrs.latex as string) || "";
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-math-inline": latex,
        class: "math-inline",
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "math-inline";
      dom.setAttribute("data-math-inline", node.attrs.latex as string);

      const render = (latex: string) => {
        dom.innerHTML = "";
        if (!latex) return;
        try {
          katex.render(latex, dom, { displayMode: false, throwOnError: false });
        } catch {
          dom.textContent = latex;
        }
      };

      render(node.attrs.latex as string);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "mathInline") return false;
          render(updatedNode.attrs.latex as string);
          dom.setAttribute("data-math-inline", updatedNode.attrs.latex as string);
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setMathInline:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: { latex: string } }) {
          state.write(`$${node.attrs.latex?.trim() || ""}$`);
        },
      },
    };
  },
});
