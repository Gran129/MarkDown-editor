import Paragraph from "@tiptap/extension-paragraph";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { buildParagraphStyle, generateBlockId } from "@/lib/block-utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphBlock: {
      setParagraphBlockAttr: (attrs: Record<string, string | null>) => ReturnType;
      increaseParagraphIndent: () => ReturnType;
      decreaseParagraphIndent: () => ReturnType;
      toggleFirstLineIndent: () => ReturnType;
      setParagraphSpacing: (before: string | null, after: string | null) => ReturnType;
      setParagraphLineSpacing: (value: string | null) => ReturnType;
    };
  }
}

const BlockIdPluginKey = new PluginKey("paragraphBlockId");

function parseParagraphAttrs(element: HTMLElement) {
  return {
    blockId: element.getAttribute("data-block-id"),
    textIndent: element.getAttribute("data-text-indent"),
    marginLeft: element.getAttribute("data-margin-left"),
    marginBefore: element.getAttribute("data-margin-before"),
    marginAfter: element.getAttribute("data-margin-after"),
    paragraphLineHeight: element.getAttribute("data-line-height"),
  };
}

export const ParagraphBlock = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      blockId: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-block-id"),
        renderHTML: (attrs) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
      textIndent: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-text-indent"),
        renderHTML: (attrs) =>
          attrs.textIndent ? { "data-text-indent": attrs.textIndent } : {},
      },
      marginLeft: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-margin-left"),
        renderHTML: (attrs) =>
          attrs.marginLeft ? { "data-margin-left": attrs.marginLeft } : {},
      },
      marginBefore: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-margin-before"),
        renderHTML: (attrs) =>
          attrs.marginBefore ? { "data-margin-before": attrs.marginBefore } : {},
      },
      marginAfter: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-margin-after"),
        renderHTML: (attrs) =>
          attrs.marginAfter ? { "data-margin-after": attrs.marginAfter } : {},
      },
      paragraphLineHeight: {
        default: null as string | null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-line-height"),
        renderHTML: (attrs) =>
          attrs.paragraphLineHeight
            ? { "data-line-height": attrs.paragraphLineHeight }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "p", getAttrs: (el) => parseParagraphAttrs(el as HTMLElement) }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const style = buildParagraphStyle({
      blockId: node.attrs.blockId as string | null,
      textIndent: node.attrs.textIndent as string | null,
      marginLeft: node.attrs.marginLeft as string | null,
      marginBefore: node.attrs.marginBefore as string | null,
      marginAfter: node.attrs.marginAfter as string | null,
      paragraphLineHeight: node.attrs.paragraphLineHeight as string | null,
    });
    return [
      "p",
      {
        ...HTMLAttributes,
        ...(style ? { style } : {}),
      },
      0,
    ];
  },

  addCommands() {
    return {
      setParagraphBlockAttr:
        (attrs) =>
        ({ chain }) =>
          chain().focus().updateAttributes("paragraph", attrs).run(),

      increaseParagraphIndent:
        () =>
        ({ editor, chain }) => {
          const { marginLeft } = editor.getAttributes("paragraph");
          const current = marginLeft ? Number.parseFloat(marginLeft) : 0;
          return chain()
            .focus()
            .updateAttributes("paragraph", { marginLeft: `${current + 2}em` })
            .run();
        },

      decreaseParagraphIndent:
        () =>
        ({ editor, chain }) => {
          const { marginLeft } = editor.getAttributes("paragraph");
          const current = marginLeft ? Number.parseFloat(marginLeft) : 0;
          const next = Math.max(0, current - 2);
          return chain()
            .focus()
            .updateAttributes("paragraph", {
              marginLeft: next > 0 ? `${next}em` : null,
            })
            .run();
        },

      toggleFirstLineIndent:
        () =>
        ({ editor, chain }) => {
          const { textIndent } = editor.getAttributes("paragraph");
          return chain()
            .focus()
            .updateAttributes("paragraph", {
              textIndent: textIndent ? null : "2em",
            })
            .run();
        },

      setParagraphSpacing:
        (before, after) =>
        ({ chain }) =>
          chain()
            .focus()
            .updateAttributes("paragraph", {
              marginBefore: before,
              marginAfter: after,
            })
            .run(),

      setParagraphLineSpacing:
        (value) =>
        ({ chain }) =>
          chain()
            .focus()
            .updateAttributes("paragraph", { paragraphLineHeight: value })
            .run(),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: BlockIdPluginKey,
        appendTransaction: (_transactions, _oldState, newState) => {
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "paragraph") return;
            if (node.attrs.blockId) return;
            if (node.textContent.length === 0) return;
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              blockId: generateBlockId(),
            });
            changed = true;
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});
