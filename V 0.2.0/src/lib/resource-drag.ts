/** In-app resource drag token. WebView2 often hides DataTransfer payloads during dragover. */

let activeRelative: string | null = null;

export function beginResourceDrag(relative: string) {
  activeRelative = relative;
}

export function endResourceDrag() {
  activeRelative = null;
}

export function getResourceDrag(): string | null {
  return activeRelative;
}

export function isResourceDragEvent(event: DragEvent): boolean {
  if (activeRelative) return true;
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes("text/resource-path");
}
