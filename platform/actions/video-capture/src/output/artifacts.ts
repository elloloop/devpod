import * as fs from "node:fs";
import * as path from "node:path";
import type { CaptureResult } from "../types.js";

/**
 * Write GitHub Actions outputs using the GITHUB_OUTPUT file mechanism.
 *
 * When running outside of Actions (e.g. locally for development), outputs
 * are printed to stdout instead.
 */
export function setOutputs(result: CaptureResult): void {
  const entries: [string, string][] = [
    ["video-path", result.videoPath ?? ""],
    ["screenshot-paths", JSON.stringify(result.screenshotPaths)],
    ["thumbnail-path", result.thumbnailPath ?? ""],
    ["duration", String(result.durationSeconds)],
  ];

  const outputFile = process.env.GITHUB_OUTPUT;

  for (const [key, value] of entries) {
    if (outputFile) {
      fs.appendFileSync(outputFile, `${key}=${value}\n`);
    } else {
      console.log(`::set-output name=${key}::${value}`);
    }
  }
}

/**
 * Write a Markdown summary file containing embedded screenshots and a link
 * to the video.  Also appends to GITHUB_STEP_SUMMARY when available.
 */
export function writeSummary(
  result: CaptureResult,
  outputDir: string,
  scenarioName: string,
): void {
  const lines: string[] = [];
  lines.push(`# Video Capture: ${scenarioName}`);
  lines.push("");

  if (result.videoPath) {
    const relVideo = path.relative(process.cwd(), result.videoPath);
    lines.push(`## Video`);
    lines.push(`- **Path:** \`${relVideo}\``);
    lines.push(`- **Duration:** ${result.durationSeconds}s`);
    lines.push("");
  }

  if (result.thumbnailPath) {
    const relThumb = path.relative(process.cwd(), result.thumbnailPath);
    lines.push(`## Thumbnail`);
    lines.push(`![thumbnail](${relThumb})`);
    lines.push("");
  }

  if (result.screenshotPaths.length > 0) {
    lines.push(`## Screenshots`);
    lines.push("");
    for (const sp of result.screenshotPaths) {
      const name = path.basename(sp, path.extname(sp));
      const rel = path.relative(process.cwd(), sp);
      lines.push(`### ${name}`);
      lines.push(`![${name}](${rel})`);
      lines.push("");
    }
  }

  const markdown = lines.join("\n");

  // Write to output directory.
  const summaryPath = path.join(outputDir, "summary.md");
  fs.writeFileSync(summaryPath, markdown, "utf-8");
  console.log(`Summary written to ${summaryPath}`);

  // Append to GitHub step summary if running in Actions.
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(summaryFile, markdown + "\n");
  }
}
