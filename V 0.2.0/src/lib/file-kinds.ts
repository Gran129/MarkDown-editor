import { extensionOf, isNoteFileName } from "@/lib/note-format";
import { isOfficeFileName } from "@/lib/office";

export type OpenableKind = "note" | "office" | "pdf" | "xmind";

export function openableKindFromPath(path: string): OpenableKind | null {
  if (isNoteFileName(path)) return "note";
  if (isOfficeFileName(path)) return "office";
  const ext = extensionOf(path);
  if (ext === "pdf") return "pdf";
  if (ext === "xmind") return "xmind";
  return null;
}

export function isOpenableFileName(path: string): boolean {
  return openableKindFromPath(path) !== null;
}

export function isBinaryOpenable(kind: OpenableKind | null | undefined): boolean {
  return kind === "office" || kind === "pdf" || kind === "xmind";
}

export const MEDIA_DIALOG_EXTENSIONS = [
  "docx",
  "xlsx",
  "pptx",
  "doc",
  "xls",
  "ppt",
  "pdf",
  "xmind",
];
