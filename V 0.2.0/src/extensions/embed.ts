import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { EmbedView } from "@/components/editor/EmbedView";
import { parseEmbedText, resolveLinkTarget } from "@/lib/link-attrs";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attributes: { target: string; size?: string }) => ReturnType;
    };
  }
}

function parseEmbedAttrs(element: HTMLElement): { target: string; size: string | null } {
  const parsed = parseEmbedText(element.textContent || "");
  const target = resolveLinkTarget(element.getAttribute("data-target"), parsed?.target);
  return {
    target,
    size: element.getAttribute("data-size") || parsed?.size || null,
  };
}

export const Embed = Node.create({
  name: "embed",
  group: "block",
  inline: false,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      target: { default: "" },
      size: { default: null },
      collapsed: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed="true"]',
        getAttrs: (element) => parseEmbedAttrs(element as HTMLElement),
      },
      {
        tag: 'span[data-embed="true"]',
        getAttrs: (element) => parseEmbedAttrs(element as HTMLElement),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const target = resolveLinkTarget(node.attrs.target);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-embed": "true",
        "data-target": target,
        class: "embed",
      }),
      target ? `![[${target}]]` : "![[]]",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView, { as: "div" });
  },

  addCommands() {
    return {
      setEmbed:
        (attributes) =>
        ({ commands }) => {
          const target = resolveLinkTarget(attributes.target);
          if (!target) return false;
          return commands.insertContent({ type: this.name, attrs: { target, size: attributes.size ?? null } });
        },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: { target: string; size: string | null } }) {
          const target = resolveLinkTarget(node.attrs.target);
          if (!target) return;
          if (node.attrs.size) {
            state.write(`![[${target}|${node.attrs.size}]]`);
          } else {
            state.write(`![[${target}]]`);
          }
        },
      },
    };
  },
});
