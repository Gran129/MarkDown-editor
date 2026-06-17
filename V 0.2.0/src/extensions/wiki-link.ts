import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions } from "@tiptap/suggestion";

import {
  normalizeWikiLinkAttrs,
  parseWikiLinkText,
  resolveLinkLabel,
  resolveLinkTarget,
} from "@/lib/link-attrs";

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
const WikiLinkFixPluginKey = new PluginKey("wikiLinkFix");

function parseWikiLinkAttrs(element: HTMLElement): Record<string, string | boolean> {
  const rawTarget = element.getAttribute("data-target");
  const rawLabel = element.getAttribute("data-label");
  const parsed = parseWikiLinkText(element.textContent || "");
  const target = resolveLinkTarget(rawTarget, parsed?.target ?? rawLabel);
  const label = resolveLinkLabel(rawTarget, rawLabel ?? parsed?.label ?? element.textContent);
  return { target, label, unresolved: false };
}

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
      target: { default: "" },
      label: { default: "" },
      unresolved: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link="true"]',
        getAttrs: (element) => parseWikiLinkAttrs(element as HTMLElement),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const target = resolveLinkTarget(node.attrs.target, node.attrs.label);
    const label = resolveLinkLabel(node.attrs.target, node.attrs.label);
    const display = label || target;
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-wiki-link": "true",
        "data-target": target,
        "data-label": label,
        class: `wiki-link${node.attrs.unresolved ? " unresolved" : ""}`,
      }),
      display ? `[[${display}]]` : "[[]]",
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ commands }) => {
          const target = resolveLinkTarget(attributes.target, attributes.label);
          if (!target) return false;
          return commands.insertContent({
            type: this.name,
            attrs: normalizeWikiLinkAttrs({
              target,
              label: attributes.label ?? target,
            }),
          });
        },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: { target: string; label: string } },
        ) {
          const target = resolveLinkTarget(node.attrs.target, node.attrs.label);
          if (!target) return;
          const label = resolveLinkLabel(node.attrs.target, node.attrs.label);
          if (label && label !== target) {
            state.write(`[[${target}|${label}]]`);
          } else {
            state.write(`[[${target}]]`);
          }
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const fixPlugin = new Plugin({
      key: WikiLinkFixPluginKey,
      appendTransaction: (_transactions, _oldState, newState) => {
        let tr = newState.tr;
        let changed = false;

        newState.doc.descendants((node, pos) => {
          if (node.type.name !== "wikiLink") return;
          const normalized = normalizeWikiLinkAttrs(node.attrs as Record<string, unknown>);
          if (
            node.attrs.target !== normalized.target ||
            node.attrs.label !== normalized.label
          ) {
            tr = tr.setNodeMarkup(pos, undefined, normalized);
            changed = true;
          }
        });

        return changed ? tr : null;
      },
    });

    return [
      fixPlugin,
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
