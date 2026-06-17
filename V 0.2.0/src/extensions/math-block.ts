import { Node, mergeAttributes } from "@tiptap/core";
import katex from "katex";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (attributes: { latex: string }) => ReturnType;
    };
  }
}

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-math-block]",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            latex: el.getAttribute("data-math-block") || el.textContent || "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const latex = (node.attrs.latex as string) || "";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-math-block": latex,
        class: "math-block",
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "math-block";
      dom.setAttribute("data-math-block", node.attrs.latex as string);

      const render = (latex: string) => {
        dom.innerHTML = "";
        if (!latex) return;
        try {
          katex.render(latex, dom, { displayMode: true, throwOnError: false });
        } catch {
          dom.textContent = latex;
        }
      };

      render(node.attrs.latex as string);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "mathBlock") return false;
          render(updatedNode.attrs.latex as string);
          dom.setAttribute("data-math-block", updatedNode.attrs.latex as string);
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setMathBlock:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: { attrs: { latex: string } }) {
          const latex = node.attrs.latex?.trim() || "";
          state.write(`$$\n${latex}\n$$`);
          state.closeBlock(node);
        },
      },
    };
  },
});
