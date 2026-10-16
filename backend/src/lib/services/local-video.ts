import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { HttpError } from "@/lib/http";

export const VIDEO_STORAGE_ROOT = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.VIDEO_STORAGE_PATH ?? "data/video-reviews",
);

export function resolveVideoStoragePath(relativePath: string): string {
  const absolutePath = path.resolve(VIDEO_STORAGE_ROOT, relativePath);
  const rootWithSeparator = VIDEO_STORAGE_ROOT.endsWith(path.sep) ? VIDEO_STORAGE_ROOT : `${VIDEO_STORAGE_ROOT}${path.sep}`;
  if (!absolutePath.startsWith(rootWithSeparator)) throw new Error("Invalid local video path");
  return absolutePath;
}

export function storagePathFor(date: string, id: string, fileName: string): string {
  return [date, id, fileName].join("/");
}

export async function writeVideoUpload(
  relativePath: string,
  body: ReadableStream<Uint8Array> | null,
  expectedBytes: number,
): Promise<number> {
  if (!body) throw new HttpError(400, "The upload request has no video body.");

  const destination = resolveVideoStoragePath(relativePath);
  const temporary = `${destination}.uploading`;
  await mkdir(path.dirname(destination), { recursive: true });
  const writer = createWriteStream(temporary, { flags: "wx" });
  const reader = body.getReader();
  let written = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.byteLength;
      if (written > expectedBytes || written > 1_073_741_824) {
        throw new HttpError(413, "Uploaded video is larger than the declared size.");
      }
      if (!writer.write(Buffer.from(value))) await once(writer, "drain");
    }
    writer.end();
    await once(writer, "finish");
    if (written !== expectedBytes) {
      throw new HttpError(400, `Expected ${expectedBytes} bytes but received ${written}.`);
    }
    await rename(temporary, destination);
    return written;
  } catch (error) {
    writer.destroy();
    await rm(temporary, { force: true });
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function assertLocalVideo(relativePath: string, expectedBytes?: number): Promise<string> {
  const absolutePath = resolveVideoStoragePath(relativePath);
  let details;
  try {
    details = await stat(absolutePath);
  } catch {
    throw new HttpError(409, "Upload the video before starting the review.");
  }
  if (!details.isFile() || (expectedBytes !== undefined && details.size !== expectedBytes)) {
    throw new HttpError(409, "The local video upload is incomplete.");
  }
  return absolutePath;
}
