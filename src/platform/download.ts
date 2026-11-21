/**
 * Hands bytes to the browser as a download. Saving into the same file again needs the
 * Chromium-only File System Access API, so it waits for the desktop build (docs/adr/0006).
 */
export function downloadFile(fileName: string, bytes: Uint8Array, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoke later: some browsers start reading the blob only after click() returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

/** Reads a file the user picked. */
export const readFileBytes = async (file: Blob): Promise<Uint8Array> =>
  new Uint8Array(await file.arrayBuffer());
