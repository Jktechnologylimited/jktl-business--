/** Route handlers do not inherit Server Actions' Origin/Host protection. */
export function sameOriginGameWrite(req: Request): boolean {
  try {
    const source = new URL(req.headers.get("origin") || "");
    const host = req.headers.get("host")?.toLowerCase();
    // Next/reverse proxies can use an internal hostname in req.url. The
    // browser's exact external Host is the CSRF boundary, not that hostname.
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname);
    const protocol = process.env.NODE_ENV === "production" && !loopback ? "https:" : new URL(req.url).protocol;
    return source.host === host && source.protocol === protocol;
  } catch { return false; }
}

export class GameRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** Bound bytes while reading, rather than after allocating an arbitrary body. */
export async function readGameDocument(req: Request): Promise<Record<string, unknown>> {
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    throw new GameRequestError("Use application/json.", 415);
  const max = 12000;
  if (Number(req.headers.get("content-length")) > max) throw new GameRequestError("Save too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new GameRequestError("Invalid save.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new GameRequestError("Save too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new GameRequestError("Invalid save.", 400); }
}
