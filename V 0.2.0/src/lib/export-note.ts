import { save } from "@tauri-apps/plugin-dialog";

import { serializeFrontmatter } from "./markdown";
import { NATIVE_NOTE_EXT, stripNoteExtension } from "./note-format";
import { exportNote, readFile, type NoteExportFormat } from "./tauri-api";
import type { TabState } from "./types";

export type { NoteExportFormat };

export function defaultExportFileName(sourcePath: string, format: NoteExportFormat): string {
  const stem = stripNoteExtension(sourcePath) || "note";
  return format === "encrypted" ? `${stem}.${NATIVE_NOTE_EXT}` : `${stem}.md`;
}

export async function resolveExportContent(
  path: string,
  tab: TabState | undefined,
): Promise<string> {
  if (tab && tab.path === path) {
    return serializeFrontmatter(tab.frontmatter, tab.content);
  }
  return readFile(path);
}

export async function pickExportDestination(
  sourcePath: string,
  format: NoteExportFormat,
): Promise<string | null> {
  const selected = await save({
    defaultPath: defaultExportFileName(sourcePath, format),
    filters:
      format === "encrypted"
        ? [{ name: "加密笔记 (.mdte)", extensions: [NATIVE_NOTE_EXT] }]
        : [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!selected) return null;
  return selected;
}

export async function runNoteExport(options: {
  sourcePath: string;
  format: NoteExportFormat;
  tab?: TabState;
}): Promise<string | null> {
  const destPath = await pickExportDestination(options.sourcePath, options.format);
  if (!destPath) return null;
  const content = await resolveExportContent(options.sourcePath, options.tab);
  return exportNote(options.sourcePath, destPath, content, options.format);
}
