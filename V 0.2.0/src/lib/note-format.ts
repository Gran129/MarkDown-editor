/** Working notes are plaintext Markdown. Encrypted `.mdte` is export-only. */
export const NATIVE_NOTE_EXT = "md";

export const ENCRYPTED_NOTE_EXT = "mdte";

export const NOTE_EXTENSIONS = ["mdte", "mde", "md"] as const;

export type NoteExtension = (typeof NOTE_EXTENSIONS)[number];

export function fileNameOf(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export function extensionOf(path: string): string {
  const name = fileNameOf(path);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isNoteExtension(ext: string): ext is NoteExtension {
  return NOTE_EXTENSIONS.includes(ext.toLowerCase() as NoteExtension);
}

export function isNoteFileName(path: string): boolean {
  return isNoteExtension(extensionOf(path));
}

export function isEncryptedNotePath(path: string): boolean {
  const ext = extensionOf(path);
  return ext === "mdte" || ext === "mde";
}

export function stripNoteExtension(path: string): string {
  return fileNameOf(path).replace(/\.(mdte|mde|md)$/i, "");
}

export function nativeNoteFileName(stem: string): string {
  const clean = stripNoteExtension(stem.trim()) || "note";
  return `${clean}.${NATIVE_NOTE_EXT}`;
}

export function toNativeNotePath(path: string): string {
  return path.replace(/\.(mdte|mde|md)$/i, "") + `.${NATIVE_NOTE_EXT}`;
}

export function parentDir(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : ".";
}

export function noteWorkDir(notePath: string): string {
  const stem = stripNoteExtension(notePath) || "note";
  return `${parentDir(notePath)}/.${stem}`;
}

export function isRemoteMedia(src: string): boolean {
  const lower = src.trim().toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("asset:") ||
    lower.startsWith("mailto:")
  );
}

export function isAbsoluteFilePath(src: string): boolean {
  return /^([a-zA-Z]:[\\/]|\/)/.test(src);
}

export function resolveNoteMediaFile(
  notePath: string | null | undefined,
  vaultPath: string | null | undefined,
  src: string,
): string {
  const trimmed = src.trim();
  if (!trimmed || isRemoteMedia(trimmed) || isAbsoluteFilePath(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replace(/\\/g, "/");
  const base = notePath
    ? normalized.startsWith(".resources/") || normalized.includes("/.resources/")
      ? noteWorkDir(notePath)
      : isEncryptedNotePath(notePath)
        ? noteWorkDir(notePath)
        : parentDir(notePath)
    : (vaultPath ?? "");
  if (!base) return trimmed;
  return `${base}/${trimmed}`.replace(/\\/g, "/").replace(/([^:])\/{2,}/g, "$1/");
}
