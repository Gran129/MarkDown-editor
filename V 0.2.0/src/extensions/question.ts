import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

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
        ({ commands }) => {
          const data = createQuestion(kind);
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: data.id,
              kind: data.kind,
              payload: encodeQuestionPayload(data),
            },
          });
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
