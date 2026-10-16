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
// Six-second sampling plus even downsampling keeps a 45-minute recording within the model request
// while still including frames from the beginning, middle, and end of the whole session.
const FRAME_INTERVAL_SECONDS = 6;
const MAX_FRAMES = 500;

const analysisSchema = z.object({
  summary: z.string().min(1).max(500),
  moments: z
    .array(
      z.object({
        startSeconds: z.number().nonnegative(),
        endSeconds: z.number().positive(),
        eventType: z.enum(["possible_escalation", "recovery", "notable_progress"]),
        title: z.string().trim().min(1).max(60),
        caption: z.string().min(1).max(300),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(8),
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
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

async function videoDurationSeconds(videoPath: string): Promise<number> {
  try {
    await execFileAsync(ffmpeg.path, ["-hide_banner", "-i", videoPath], { maxBuffer: 2 * 1024 * 1024 });
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
    if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  throw new Error("FFmpeg could not read the video duration.");
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
  const allFrameNames = (await readdir(frameDirectory)).filter((name) => name.endsWith(".jpg")).sort();
  if (allFrameNames.length === 0) throw new Error("No readable video frames were found.");
  const frameNames = allFrameNames.length <= MAX_FRAMES
    ? allFrameNames
    : Array.from({ length: MAX_FRAMES }, (_, index) =>
        allFrameNames[Math.round((index * (allFrameNames.length - 1)) / (MAX_FRAMES - 1))],
      );

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "low" }
  > = [
    {
      type: "input_text",
      text: `Review this recorded therapy or learning session using only observable actions and speech. Do not diagnose, label intent, or make clinical conclusions.

Write an overall gist in at most two short sentences. Do not narrate the session in order or list routine activities. Focus on the main pattern and only meaningful details a covering therapist should know, such as a clear escalation, what preceded it, the response, recovery, or a notable success. Use neutral wording (for example, "shouted and pushed a chair" rather than "had a tantrum").

Identify up to 8 short clips of important moments only: possible escalation (such as sustained crying, shouting, hitting, throwing objects, or leaving the activity), recovery, or notable progress. Give each clip a plain title of 2–6 words (for example, "Pushed a chair" or "Shouted during transition") and a one-sentence factual caption. Do not create clips for routine activity.

Times must match the timestamped transcript and sampled frames. Make each moment 5 to 30 seconds long and include a little context before and after. If evidence is uncertain, omit the moment rather than guessing.

Timestamped transcript:
${transcript || "(No intelligible speech was transcribed.)"}`,
    },
  ];

  for (let index = 0; index < frameNames.length; index += 1) {
    const frameNumber = Number(/frame-(\d+)\.jpg$/.exec(frameNames[index])?.[1] ?? index + 1);
    const seconds = (frameNumber - 1) * FRAME_INTERVAL_SECONDS;
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
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured in backend/.env.");

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
        "-q:v",
        "5",
        path.join(frameDirectory, "frame-%05d.jpg"),
      ]),
    ]);

    const durationSeconds = await videoDurationSeconds(sourcePath);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcript = await transcribe(client, audioPath);
    const analysis = await analyzeFrames(client, transcript, frameDirectory);
    const clips: VideoReviewClipInput[] = [];

    for (let index = 0; index < analysis.moments.length; index += 1) {
      const moment = analysis.moments[index];
      const startSeconds = Math.max(0, Math.floor(moment.startSeconds - 3));
      const requestedEnd = Math.max(moment.endSeconds + 4, startSeconds + 5);
      const endSeconds = Math.min(durationSeconds, startSeconds + 35, requestedEnd);
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
        title: moment.title,
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
