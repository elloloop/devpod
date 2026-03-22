import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ActionInputs, CaptureResult, VideoQuality } from "../types.js";
import { parseScenario } from "../scenario/parser.js";
import { runScenario, type RunnerContext } from "../scenario/runner.js";
import { compressVideo, getVideoDuration, trimVideo } from "../processing/video.js";
import { generateThumbnail } from "../processing/thumbnail.js";
import { optimizeScreenshot } from "../processing/screenshot.js";

/** Map quality names to Playwright video scale factors. */
function videoSize(
  quality: VideoQuality,
  width: number,
  height: number,
): { width: number; height: number } {
  switch (quality) {
    case "low":
      return {
        width: Math.round(width * 0.5),
        height: Math.round(height * 0.5),
      };
    case "high":
      return { width, height };
    case "medium":
    default:
      return {
        width: Math.round(width * 0.75),
        height: Math.round(height * 0.75),
      };
  }
}

/**
 * Run a full web capture session using Playwright:
 *  1. Launch browser (headless or headed).
 *  2. Start recording video.
 *  3. Execute scenario steps.
 *  4. Close context to finalise the video file.
 *  5. Post-process video (trim + compress via ffmpeg).
 *  6. Generate thumbnail.
 *  7. Optimise screenshots.
 */
export async function captureWeb(inputs: ActionInputs): Promise<CaptureResult> {
  const {
    scenario: scenarioPath,
    outputDir,
    videoQuality,
    viewportWidth,
    viewportHeight,
    headless,
    appUrl,
  } = inputs;

  // Ensure output directory exists.
  fs.mkdirSync(outputDir, { recursive: true });
  const rawVideoDir = path.join(outputDir, ".raw-video");
  fs.mkdirSync(rawVideoDir, { recursive: true });

  // Parse the scenario file, injecting variables.
  const variables: Record<string, string> = {};
  if (appUrl) variables["app-url"] = appUrl;
  const scenario = parseScenario(scenarioPath, variables);

  // Launch browser.
  const size = videoSize(videoQuality, viewportWidth, viewportHeight);
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  const screenshotPaths: string[] = [];
  let rawVideoPath: string | null = null;

  try {
    browser = await chromium.launch({ headless });
    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      recordVideo: {
        dir: rawVideoDir,
        size,
      },
    });
    page = await context.newPage();

    const ctx: RunnerContext = { page, outputDir, screenshotPaths };
    await runScenario(scenario, ctx);

    // Close page + context so Playwright finalises the video.
    await page.close();
    await context.close();

    // Playwright writes the video file into rawVideoDir; find it.
    const files = fs.readdirSync(rawVideoDir).filter((f) => f.endsWith(".webm"));
    if (files.length > 0) {
      rawVideoPath = path.join(rawVideoDir, files[0]);
    }
  } finally {
    // Ensure browser is always closed.
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  // ── Post-process ───────────────────────────────────────────────────
  let finalVideoPath: string | null = null;
  let durationSeconds = 0;
  let thumbnailPath: string | null = null;

  if (rawVideoPath && fs.existsSync(rawVideoPath)) {
    // Try trimming + compressing via ffmpeg.
    const trimmedPath = path.join(outputDir, "demo-trimmed.webm");
    const compressedPath = path.join(outputDir, "demo.mp4");

    const trimmed = await trimVideo(rawVideoPath, trimmedPath);
    const sourceForCompress = trimmed ? trimmedPath : rawVideoPath;
    const compressed = await compressVideo(
      sourceForCompress,
      compressedPath,
      videoQuality,
    );

    if (compressed) {
      finalVideoPath = compressedPath;
      // Clean up trimmed intermediate.
      if (trimmed && fs.existsSync(trimmedPath)) {
        fs.unlinkSync(trimmedPath);
      }
    } else if (trimmed) {
      finalVideoPath = trimmedPath;
    } else {
      // Fall back to raw Playwright video.
      const fallback = path.join(outputDir, "demo.webm");
      fs.copyFileSync(rawVideoPath, fallback);
      finalVideoPath = fallback;
    }

    durationSeconds = await getVideoDuration(finalVideoPath);

    // Thumbnail from first interesting frame.
    const thumbPath = path.join(outputDir, "thumbnail.png");
    thumbnailPath = await generateThumbnail(finalVideoPath, thumbPath);
  }

  // Optimise each screenshot (optional sharp dependency).
  const optimisedPaths: string[] = [];
  for (const sp of screenshotPaths) {
    const optimised = await optimizeScreenshot(sp);
    optimisedPaths.push(optimised);
  }

  // Clean up raw video directory.
  fs.rmSync(rawVideoDir, { recursive: true, force: true });

  return {
    videoPath: finalVideoPath,
    screenshotPaths: optimisedPaths,
    thumbnailPath,
    durationSeconds,
  };
}
