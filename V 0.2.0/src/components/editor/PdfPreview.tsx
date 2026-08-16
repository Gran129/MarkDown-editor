import { convertFileSrc } from "@tauri-apps/api/core";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fileNameOf } from "@/lib/note-format";
import { openPath } from "@/lib/tauri-api";

interface PdfPreviewProps {
  path: string;
  editable?: boolean;
}

export function PdfPreview({ path, editable = false }: PdfPreviewProps) {
  let src = path;
  try {
    src = convertFileSrc(path);
  } catch {
    src = path;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs">
        <span className="min-w-0 truncate">{fileNameOf(path)}</span>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => void openPath(path)}
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            用系统应用编辑
          </Button>
        )}
      </div>
      <iframe title={fileNameOf(path)} src={src} className="min-h-[28rem] w-full flex-1 bg-white" />
    </div>
  );
}
