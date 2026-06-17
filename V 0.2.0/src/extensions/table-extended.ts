import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

export type TableColAlign = "left" | "center" | "right" | null;

const sharedCellAttributes = {
  colAlign: {
    default: null as TableColAlign,
    parseHTML: (element: HTMLElement) => {
      const fromData = element.getAttribute("data-col-align");
      if (fromData === "left" || fromData === "center" || fromData === "right") {
        return fromData;
      }
      const align = element.style.textAlign;
      if (align === "left" || align === "center" || align === "right") return align;
      return null;
    },
    renderHTML: (attributes: { colAlign: TableColAlign }) => {
      if (!attributes.colAlign) return {};
      return { "data-col-align": attributes.colAlign };
    },
  },
  backgroundColor: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute("data-bg-color") || element.style.backgroundColor || null,
    renderHTML: (attributes: { backgroundColor: string | null }) => {
      if (!attributes.backgroundColor) return {};
      return {
        "data-bg-color": attributes.backgroundColor,
        style: `background-color: ${attributes.backgroundColor}`,
      };
    },
  },
};

export const ExtendedTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...sharedCellAttributes,
    };
  },
});

export const ExtendedTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...sharedCellAttributes,
    };
  },
});
