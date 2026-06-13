export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes: ArrayBuffer =
    typeof data === "string"
      ? (new TextEncoder().encode(data).buffer as ArrayBuffer)
      : data instanceof Uint8Array
      ? (data.slice().buffer as ArrayBuffer)
      : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "0x" + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256Hex(buf);
}
