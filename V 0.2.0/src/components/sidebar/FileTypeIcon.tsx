import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  GitBranch,
  Presentation,
} from "lucide-react";

import { extensionOf } from "@/lib/note-format";
import { openableKindFromPath } from "@/lib/file-kinds";
import { cn } from "@/lib/utils";

const iconClass = "h-4 w-4 shrink-0 text-muted-foreground";

export function FileTypeIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const cls = cn(iconClass, className);
  const ext = extensionOf(name);
  const kind = openableKindFromPath(name);

  if (kind === "pdf" || ext === "pdf") return <File className={cls} />;
  if (kind === "xmind" || ext === "xmind") return <GitBranch className={cls} />;
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return <FileSpreadsheet className={cls} />;
  if (ext === "pptx" || ext === "ppt") return <Presentation className={cls} />;
  if (ext === "docx" || ext === "doc") return <FileText className={cls} />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return <FileImage className={cls} />;
  }
  if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext)) return <FileAudio className={cls} />;
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return <FileVideo className={cls} />;
  if (["zip", "7z", "rar", "tar", "gz"].includes(ext)) return <FileArchive className={cls} />;
  if (
    ["js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "json", "yml", "yaml", "html", "css"].includes(
      ext,
    )
  ) {
    return <FileCode className={cls} />;
  }
  if (["md", "mdte", "mde", "txt"].includes(ext)) return <FileText className={cls} />;
  return <File className={cls} />;
}
