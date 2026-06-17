import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import Highlight from "@tiptap/extension-highlight";
import Strike from "@tiptap/extension-strike";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Underline from "@tiptap/extension-underline";
import { defaultMarkdownSerializer } from "prosemirror-markdown";

const colorAttribute = {
  color: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute("data-color") || null,
    renderHTML: (attrs: { color: string | null }) =>
      attrs.color ? { "data-color": attrs.color } : {},
  },
};

/** 加粗：标准 Markdown `**text**` */
export const MarkdownBold = Bold.extend({
  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.marks.strong,
        parse: {},
      },
    };
  },
});

/** 高亮：Obsidian `==text==`；带颜色时用 MDED 语法 */
export const MarkdownHighlight = Highlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...colorAttribute,
    };
  },

  parseHTML() {
    return [
      { tag: "mark" },
      { tag: "mark[data-mded-hl]" },
      {
        tag: "span[data-mded-hl]",
        getAttrs: (el) => ({
          color: (el as HTMLElement).getAttribute("data-color"),
        }),
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const color = mark.attrs.color as string | null;
    if (color) {
      return [
        "mark",
        {
          ...HTMLAttributes,
          "data-mded-hl": "true",
          "data-color": color,
          style: `background-color:${color}`,
        },
        0,
      ];
    }
    return ["mark", HTMLAttributes, 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize: { open: "==", close: "==" },
        parse: {},
      },
    };
  },
});

export const MarkdownUnderline = Underline.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...colorAttribute,
    };
  },

  parseHTML() {
    return [
      { tag: "u" },
      {
        tag: "span[data-mded-ul]",
        getAttrs: (el) => ({
          color: (el as HTMLElement).getAttribute("data-color"),
        }),
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const color = mark.attrs.color as string | null;
    if (color) {
      return [
        "span",
        {
          ...HTMLAttributes,
          "data-mded-ul": "true",
          "data-color": color,
          style: `text-decoration:underline;color:${color}`,
        },
        0,
      ];
    }
    return ["u", HTMLAttributes, 0];
  },
});

export const MarkdownStrike = Strike.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...colorAttribute,
    };
  },

  parseHTML() {
    return [
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      {
        tag: "span[data-mded-strike]",
        getAttrs: (el) => ({
          color: (el as HTMLElement).getAttribute("data-color"),
        }),
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const color = mark.attrs.color as string | null;
    if (color) {
      return [
        "span",
        {
          ...HTMLAttributes,
          "data-mded-strike": "true",
          "data-color": color,
          style: `text-decoration:line-through;color:${color}`,
        },
        0,
      ];
    }
    return ["s", HTMLAttributes, 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize: { open: "~~", close: "~~" },
        parse: {},
      },
    };
  },
});

export const MarkdownCode = Code.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...colorAttribute,
    };
  },

  parseHTML() {
    return [
      { tag: "code" },
      {
        tag: "code[data-mded-code]",
        getAttrs: (el) => ({
          color: (el as HTMLElement).getAttribute("data-color"),
        }),
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const color = mark.attrs.color as string | null;
    if (color) {
      return [
        "code",
        {
          ...HTMLAttributes,
          "data-mded-code": "true",
          "data-color": color,
          style: `color:${color}`,
        },
        0,
      ];
    }
    return ["code", HTMLAttributes, 0];
  },
});

/** 上标：Obsidian 兼容 `^text^` */
export const MarkdownSuperscript = Superscript.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: "^", close: "^" },
        parse: {},
      },
    };
  },
});

/** 下标：HTML `<sub>`（Obsidian 可渲染 HTML） */
export const MarkdownSubscript = Subscript.extend({
  addStorage() {
    return {
      markdown: {
        serialize: { open: "<sub>", close: "</sub>" },
        parse: {},
      },
    };
  },
});

export type ColoredMarkName = "underline" | "strike" | "highlight" | "code";

export const MARK_COLOR_PRESETS = [
  { label: "默认", value: null },
  { label: "红", value: "#ef4444" },
  { label: "橙", value: "#f97316" },
  { label: "黄", value: "#eab308" },
  { label: "绿", value: "#22c55e" },
  { label: "蓝", value: "#3b82f6" },
  { label: "紫", value: "#a855f7" },
  { label: "灰", value: "#6b7280" },
];
