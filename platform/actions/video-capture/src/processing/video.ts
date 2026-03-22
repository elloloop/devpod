import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import type { QualityPreset, VideoQuality } from "../types.js";

const execFileAsync = promisify(execFile);

const QUALITY_PRESETS: Record<VideoQuality, QualityPreset> = {
  low: { crf: 32, maxBitrateKbps: 500, audioBitrateKbps: 64 },
  medium: { crf: 26, maxBitrateKbps: 1500, audioBitrateKbps: 128 },
  high: { crf: 20, maxBitrateKbps: 4000, audioBitrateKbps: 192 },
};

/** Check if ffmpeg is available on the system. */
async function hasFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run ffprobe to get the duration of a video file in seconds.
 * Returns 0 when ffprobe is not available.
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? Math.round(seconds * 100) / 100 : 0;
  } catch {
    // ffprobe unavailable — try to estimate from file stats.
    return 0;
  }
}

/**
 * Trim dead (still) frames from the beginning and end of a video.
 *
 * Strategy: Use ffmpeg's `blackdetect` / `freezedetect` filter to locate the
 * first and last frames with meaningful change, then re-encode only that
 * segment.  If detection fails or ffmpeg is not available, returns false and
 * leaves the original file untouched.
 */
export async function trimVideo(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  if (!(await hasFfmpeg())) {
    console.log("ffmpeg not found — skipping video trim");
    return false;
  }

  try {
    // Detect freeze at the start.  We look for the first non-frozen segment.
    const { stderr } = await execFileAsync("ffmpeg", [
      "-i",
      inputPath,
      "-vf",
      "freezedetect=n=0.003:d=0.5",
      "-map",
      "0:v:0",
      "-f",
      "null",
      "-",
    ]);

    // Parse freeze_end timestamps from stderr.
    const freezeEndMatches = [
      ...stderr.matchAll(/freeze_end:\s*([\d.]+)/g),
    ].map((m) => parseFloat(m[1]));

    // Also parse freeze_start for tail trimming.
    const freezeStartMatches = [
      ...stderr.matchAll(/freeze_start:\s*([\d.]+)/g),
    ].map((m) => parseFloat(m[1]));

    const totalDuration = await getVideoDuration(inputPath);

    // Determine start trim: if the first freeze_end is within the first 5s,
    // use it as the start point; otherwise start from 0.
    let startTime = 0;
    if (freezeEndMatches.length > 0 && freezeEndMatches[0] < 5) {
      startTime = freezeEndMatches[0];
    }

    // Determine end trim: if the last freeze_start is within the last 5s of
    // the video, use it as the end point.
    let endTime = totalDuration;
    if (
      freezeStartMatches.length > 0 &&
      totalDuration - freezeStartMatches[freezeStartMatches.length - 1] < 5
    ) {
      endTime = freezeStartMatches[freezeStartMatches.length - 1];
    }

    if (startTime === 0 && endTime === totalDuration) {
      console.log("No frozen frames to trim");
      return false;
    }

    const duration = endTime - startTime;
    if (duration < 0.5) {
      console.log("Trimmed duration too short — keeping original");
      return false;
    }

    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      String(startTime),
      "-i",
      inputPath,
      "-t",
      String(duration),
      "-c",
      "copy",
      outputPath,
    ]);

    console.log(
      `Trimmed video: ${startTime.toFixed(1)}s – ${endTime.toFixed(1)}s ` +
        `(${duration.toFixed(1)}s)`,
    );
    return fs.existsSync(outputPath);
  } catch (err) {
    console.warn(`Video trim failed: ${err}`);
    return false;
  }
}

/**
 * Compress / transcode a video to H.264 MP4 with the given quality preset.
 * Returns true when the compressed file was written successfully.
 */
export async function compressVideo(
  inputPath: string,
  outputPath: string,
  quality: VideoQuality,
): Promise<boolean> {
  if (!(await hasFfmpeg())) {
    console.log("ffmpeg not found — skipping video compression");
    return false;
  }

  const preset = QUALITY_PRESETS[quality];

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-crf",
        String(preset.crf),
        "-maxrate",
        `${preset.maxBitrateKbps}k`,
        "-bufsize",
        `${preset.maxBitrateKbps * 2}k`,
        "-preset",
        "fast",
        "-movflags",
        "+faststart",
        // Drop audio if present — demo videos rarely need it.
        "-an",
        outputPath,
      ],
      { timeout: 120_000 },
    );

    const stat = fs.statSync(outputPath);
    const sizeMB = stat.size / (1024 * 1024);
    console.log(
      `Compressed video: ${sizeMB.toFixed(1)} MB (quality=${quality}, crf=${preset.crf})`,
    );
    return true;
  } catch (err) {
    console.warn(`Video compression failed: ${err}`);
    return false;
  }
}
