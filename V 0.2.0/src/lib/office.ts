import { convertFileSrc } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import {
  extensionOf,
  fileNameOf,
  isAbsoluteFilePath,
  resolveNoteMediaFile,
} from "@/lib/note-format";
import { copyFile, readBinaryFile } from "@/lib/tauri-api";

export type OfficeKind = "word" | "excel" | "powerpoint";

export type OfficePreviewKind = "docx" | "xlsx" | "pptx";

export const OFFICE_DIALOG_EXTENSIONS = ["docx", "xlsx", "pptx", "doc", "xls", "ppt"];

export function officeKindFromPath(path: string): OfficeKind | null {
  switch (extensionOf(path)) {
    case "doc":
    case "docx":
      return "word";
    case "xls":
    case "xlsx":
      return "excel";
    case "ppt":
    case "pptx":
      return "powerpoint";
    default:
      return null;
  }
}

export function officePreviewKind(path: string): OfficePreviewKind | null {
  switch (extensionOf(path)) {
    case "docx":
    case "xlsx":
    case "pptx":
      return extensionOf(path) as OfficePreviewKind;
    default:
      return null;
  }
}

export function isOfficeFileName(path: string): boolean {
  return officeKindFromPath(path) !== null;
}

export function officeAppLabel(kind: OfficeKind): string {
  switch (kind) {
    case "word":
      return "Word";
    case "excel":
      return "Excel";
    case "powerpoint":
      return "PowerPoint";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function officeLookupTargets(target: string): string[] {
  const trimmed = target.trim();
  if (!trimmed) return [];
  const targets = [trimmed];
  if (
    !trimmed.includes("/") &&
    !trimmed.includes("\\") &&
    !isAbsoluteFilePath(trimmed)
  ) {
    targets.push(`.resources/${fileNameOf(trimmed)}`);
  }
  return targets;
}

export function officeLookupPaths(
  notePath: string | null | undefined,
  vaultPath: string | null | undefined,
  target: string,
): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const candidate of officeLookupTargets(target)) {
    const resolved = resolveNoteMediaFile(notePath, vaultPath, candidate);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      paths.push(resolved);
    }
  }
  return paths;
}

function bytesToArrayBuffer(bytes: number[] | Uint8Array): ArrayBuffer {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
}

export async function readOfficeArrayBuffer(path: string): Promise<ArrayBuffer> {
  try {
    const src = convertFileSrc(path);
    const response = await fetch(src);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch {
    // Fall through to the Tauri IPC reader.
  }
  return bytesToArrayBuffer(await readBinaryFile(path));
}

export async function pickLocalOfficePath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "Office",
        extensions: OFFICE_DIALOG_EXTENSIONS,
      },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function downloadOfficeCopy(sourcePath: string): Promise<boolean> {
  const ext = extensionOf(sourcePath);
  const destination = await save({
    defaultPath: fileNameOf(sourcePath),
    filters: ext
      ? [{ name: officeAppLabel(officeKindFromPath(sourcePath) ?? "word"), extensions: [ext] }]
      : undefined,
  });
  if (!destination) return false;
  await copyFile(sourcePath, destination);
  return true;
}
