import { Node, mergeAttributes } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions } from "@tiptap/suggestion";

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, string>;
  suggestion: Omit<SuggestionOptions, "editor">;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { target: string; label?: string }) => ReturnType;
    };
  }
}

export const WikiLinkPluginKey = new PluginKey("wikiLink");

export const WikiLink = Node.create<WikiLinkOptions>({
  name: "wikiLink",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: "[[",
        pluginKey: WikiLinkPluginKey,
        allowSpaces: true,
        items: () => [],
        render: () => ({
          onStart: () => {},
          onUpdate: () => {},
          onExit: () => {},
          onKeyDown: () => false,
        }),
      },
    };
  },

  addAttributes() {
    return {
      target: { default: null },
      label: { default: null },
      unresolved: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link="true"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label || node.attrs.target;
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-wiki-link": "true",
        "data-target": node.attrs.target,
        class: `wiki-link${node.attrs.unresolved ? " unresolved" : ""}`,
      }),
      `[[${label}]]`,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
