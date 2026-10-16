import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { VideoReviewClipInput } from "@/lib/repositories/video-reviews";
import { resolveVideoStoragePath } from "./local-video";

const execFileAsync = promisify(execFile);
const FRAME_INTERVAL_SECONDS = 3;
const MAX_FRAMES = 400;

const analysisSchema = z.object({
  summary: z.string().min(1).max(1_500),
  moments: z
    .array(
      z.object({
        startSeconds: z.number().nonnegative(),
        endSeconds: z.number().positive(),
        eventType: z.enum(["possible_escalation", "recovery", "notable_progress"]),
        caption: z.string().min(1).max(300),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(12),
});

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync(ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", ...args], { maxBuffer: 5 * 1024 * 1024 });
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
    throw new Error(details ? `FFmpeg failed: ${details}` : "FFmpeg could not process this video.");
  }
}

function timestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

async function transcribe(client: OpenAI, audioPath: string): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    prompt: "A therapist and a child taking part in an autism therapy or learning programme.",
  });
  const segments = transcription.segments ?? [];
  if (segments.length === 0) return transcription.text;
  return segments.map((segment) => `[${timestamp(segment.start)}-${timestamp(segment.end)}] ${segment.text.trim()}`).join("\n");
}

async function analyzeFrames(client: OpenAI, transcript: string, frameDirectory: string) {
  const frameNames = (await readdir(frameDirectory)).filter((name) => name.endsWith(".jpg")).sort();
  if (frameNames.length === 0) throw new Error("No readable video frames were found.");

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "low" }
  > = [
    {
      type: "input_text",
      text: `Review this recorded therapy or learning session using only observable actions and speech. Do not diagnose, label intent, or make clinical conclusions.

Create a short factual summary covering the activity, the child's responses, strategies used by the therapist, transitions, and the outcome. Identify up to 12 moments that would help a qualified reviewer, especially possible escalation (for example sustained crying, shouting, hitting, throwing objects, fleeing, or loss of safe participation), recovery, and notable progress.

Moment captions must be neutral and specific. Times must match the timestamp immediately before each sampled frame and the timestamped transcript. Make each moment 5 to 30 seconds long. If the evidence is uncertain, omit the moment rather than guessing.

Timestamped transcript:
${transcript || "(No intelligible speech was transcribed.)"}`,
    },
  ];

  for (let index = 0; index < frameNames.length; index += 1) {
    const seconds = index * FRAME_INTERVAL_SECONDS;
    const image = await readFile(path.join(frameDirectory, frameNames[index]));
    content.push({ type: "input_text", text: `Sampled frame at ${timestamp(seconds)} (${seconds} seconds)` });
    content.push({ type: "input_image", image_url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "low" });
  }

  const response = await client.responses.parse({
    model: process.env.OPENAI_VIDEO_MODEL ?? "gpt-6-luna",
    store: false,
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(analysisSchema, "therapy_session_review") },
  });
  if (!response.output_parsed) throw new Error("OpenAI returned no structured video review.");
  return response.output_parsed;
}

export async function analyzeSessionVideo(
  sourceStoragePath: string,
): Promise<{ summary: string; clips: VideoReviewClipInput[] }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured in backend/.env.local.");

  const sourcePath = resolveVideoStoragePath(sourceStoragePath);
  const sessionDirectory = path.dirname(sourcePath);
  const workDirectory = path.join(sessionDirectory, ".processing");
  const frameDirectory = path.join(workDirectory, "frames");
  const audioPath = path.join(workDirectory, "audio.mp3");
  await rm(workDirectory, { force: true, recursive: true });
  await mkdir(frameDirectory, { recursive: true });

  try {
    await Promise.all([
      runFfmpeg(["-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audioPath]),
      runFfmpeg([
        "-i",
        sourcePath,
        "-vf",
        `fps=1/${FRAME_INTERVAL_SECONDS},scale=480:-2`,
        "-frames:v",
        String(MAX_FRAMES),
        "-q:v",
        "5",
        path.join(frameDirectory, "frame-%05d.jpg"),
      ]),
    ]);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcript = await transcribe(client, audioPath);
    const analysis = await analyzeFrames(client, transcript, frameDirectory);
    const clips: VideoReviewClipInput[] = [];

    for (let index = 0; index < analysis.moments.length; index += 1) {
      const moment = analysis.moments[index];
      const startSeconds = Math.max(0, Math.floor(moment.startSeconds - 3));
      const requestedEnd = Math.max(moment.endSeconds + 4, startSeconds + 5);
      const endSeconds = Math.min(startSeconds + 35, requestedEnd);
      const clipStoragePath = path.posix.join(path.posix.dirname(sourceStoragePath), `clip-${index + 1}.mp4`);
      await runFfmpeg([
        "-ss",
        startSeconds.toFixed(2),
        "-i",
        sourcePath,
        "-t",
        (endSeconds - startSeconds).toFixed(2),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        resolveVideoStoragePath(clipStoragePath),
      ]);
      clips.push({
        startSeconds,
        endSeconds,
        eventType: moment.eventType,
        caption: moment.caption,
        confidence: moment.confidence,
        storagePath: clipStoragePath,
      });
    }

    return { summary: analysis.summary, clips };
  } finally {
    await rm(workDirectory, { force: true, recursive: true });
  }
}
