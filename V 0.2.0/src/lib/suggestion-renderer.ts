import { ReactRenderer } from "@tiptap/react";
import type { SuggestionProps } from "@tiptap/suggestion";

import {
  WikiLinkSuggestionList,
  type WikiLinkSuggestionItem,
  type WikiLinkSuggestionRef,
} from "@/components/editor/WikiLinkSuggestion";

export function createWikiLinkSuggestionRenderer() {
  let component: ReactRenderer<WikiLinkSuggestionRef> | null = null;
  let popup: HTMLDivElement | null = null;

  const updatePosition = (clientRect?: (() => DOMRect | null) | null) => {
    if (!popup || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;
  };

  return {
    onStart: (props: SuggestionProps<WikiLinkSuggestionItem>) => {
      component = new ReactRenderer(WikiLinkSuggestionList, {
        props,
        editor: props.editor,
      });
      popup = document.createElement("div");
      popup.style.position = "fixed";
      popup.style.zIndex = "1000";
      popup.appendChild(component.element);
      document.body.appendChild(popup);
      updatePosition(props.clientRect);
    },
    onUpdate(props: SuggestionProps<WikiLinkSuggestionItem>) {
      component?.updateProps(props);
      updatePosition(props.clientRect);
    },
    onExit() {
      popup?.remove();
      component?.destroy();
      popup = null;
      component = null;
    },
    onKeyDown(props: { event: KeyboardEvent }) {
      if (props.event.key === "Escape") return true;
      return component?.ref?.onKeyDown(props) ?? false;
    },
  };
}
