import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { handle, queryOf } from "@/lib/http";
import { getSessionVideoMedia } from "@/lib/services/video-reviews";
import { idParam } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

// GET /api/session-logs/:id/video/media?clipId=2 — private, byte-range-enabled clip playback.
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const sessionLogId = idParam.parse((await ctx.params).id);
  const query = queryOf(req);
  const clipId = query.clipId === undefined ? undefined : idParam.parse(query.clipId);
  const media = await getSessionVideoMedia(sessionLogId, clipId);
  const range = req.headers.get("range");

  if (!range) {
    const body = Readable.toWeb(createReadStream(media.path)) as ReadableStream<Uint8Array>;
    return new Response(body, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(media.size),
        "Content-Type": media.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${media.size}` } });
  const suffixLength = !match[1] && match[2] ? Number(match[2]) : null;
  const start = suffixLength === null ? (match[1] ? Number(match[1]) : 0) : Math.max(0, media.size - suffixLength);
  const end = suffixLength === null && match[2] ? Math.min(Number(match[2]), media.size - 1) : media.size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= media.size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${media.size}` } });
  }

  const body = Readable.toWeb(createReadStream(media.path, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${media.size}`,
      "Content-Type": media.contentType,
      "Cache-Control": "private, no-store",
    },
  });
});
