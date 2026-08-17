import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { TextSelection } from "@tiptap/pm/state";

import { QuestionView } from "@/components/editor/QuestionView";
import {
  createQuestion,
  decodeQuestionPayload,
  encodeQuestionPayload,
  serializeQuestionMarkdown,
  type QuestionKind,
} from "@/lib/question";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    question: {
      insertQuestion: (kind: QuestionKind) => ReturnType;
    };
  }
}

export const Question = Node.create({
  name: "question",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: "" },
      kind: { default: "single" },
      payload: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-question="true"]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const kind = (el.getAttribute("data-kind") || "single") as QuestionKind;
          const id = el.getAttribute("data-id") || "";
          const encoded = el.getAttribute("data-payload") || "";
          const data = decodeQuestionPayload(encoded) ?? createQuestion(kind);
          return {
            id: id || data.id,
            kind: data.kind,
            payload: encodeQuestionPayload({ ...data, id: id || data.id, kind: data.kind }),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-question": "true",
        "data-kind": node.attrs.kind,
        "data-id": node.attrs.id,
        "data-payload": node.attrs.payload,
        class: "question-block",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuestionView, { as: "div" });
  },

  addCommands() {
    return {
      insertQuestion:
        (kind) =>
        ({ state, dispatch }) => {
          const data = createQuestion(kind);
          const node = this.type.create({
            id: data.id,
            kind: data.kind,
            payload: encodeQuestionPayload(data),
          });
          const insertPos = state.selection.to;
          if (dispatch) {
            let tr = state.tr;
            const $pos = state.doc.resolve(insertPos);
            if ($pos.parent.isTextblock && $pos.parentOffset > 0 && $pos.parentOffset < $pos.parent.content.size) {
              tr = tr.split(insertPos);
            }
            const pos = tr.mapping.map(insertPos);
            const $mapped = tr.doc.resolve(pos);
            let at = pos;
            if ($mapped.parent.isTextblock) {
              at = $mapped.parentOffset === 0 ? $mapped.before() : $mapped.after();
            }
            tr = tr.insert(at, node);
            tr.setSelection(TextSelection.near(tr.doc.resolve(at + node.nodeSize)));
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (n: unknown) => void },
          node: { attrs: { id: string; kind: QuestionKind; payload: string } },
        ) {
          const data =
            decodeQuestionPayload(node.attrs.payload) ??
            createQuestion((node.attrs.kind as QuestionKind) || "single");
          state.write(
            serializeQuestionMarkdown({
              ...data,
              id: node.attrs.id || data.id,
              kind: (node.attrs.kind as QuestionKind) || data.kind,
            }),
          );
          state.closeBlock(node);
        },
      },
    };
  },
});
