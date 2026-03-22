import * as path from "node:path";
import type { ActionInputs, CaptureResult, Platform, VideoQuality } from "./types.js";
import { captureWeb } from "./capture/web.js";
import { captureAndroid } from "./capture/android.js";
import { captureIos } from "./capture/ios.js";
import { setOutputs, writeSummary } from "./output/artifacts.js";
import { parseScenario } from "./scenario/parser.js";

// ── Helpers ────────────────────────────────────────────────────────────

function getEnv(name: string, fallback?: string): string {
  // GitHub Actions inputs are exposed as INPUT_<NAME> env vars (upper-cased,
  // hyphens replaced with underscores).
  const envKey = `INPUT_${name.toUpperCase().replace(/-/g, "_")}`;
  return process.env[envKey] ?? fallback ?? "";
}

function resolveInputs(): ActionInputs {
  const platform = getEnv("platform") as Platform;
  if (!["web", "android", "ios"].includes(platform)) {
    throw new Error(
      `Invalid platform "${platform}". Must be one of: web, android, ios`,
    );
  }

  const scenarioPath = getEnv("scenario");
  if (!scenarioPath) {
    throw new Error("The 'scenario' input is required");
  }

  const outputDir = path.resolve(
    getEnv("output-dir", "./artifacts/video-capture"),
  );
  const videoQuality = (getEnv("video-quality", "medium") || "medium") as VideoQuality;
  if (!["low", "medium", "high"].includes(videoQuality)) {
    throw new Error(
      `Invalid video-quality "${videoQuality}". Must be one of: low, medium, high`,
    );
  }

  return {
    platform,
    appUrl: getEnv("app-url") || undefined,
    scenario: path.resolve(scenarioPath),
    outputDir,
    videoQuality,
    viewportWidth: parseInt(getEnv("viewport-width", "1280"), 10) || 1280,
    viewportHeight: parseInt(getEnv("viewport-height", "720"), 10) || 720,
    device: getEnv("device") || undefined,
    headless: getEnv("headless", "true") !== "false",
  };
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const inputs = resolveInputs();

  console.log("=== Video Capture Action ===");
  console.log(`  Platform:     ${inputs.platform}`);
  console.log(`  Scenario:     ${inputs.scenario}`);
  console.log(`  Output dir:   ${inputs.outputDir}`);
  console.log(`  Quality:      ${inputs.videoQuality}`);
  if (inputs.platform === "web") {
    console.log(`  Viewport:     ${inputs.viewportWidth}x${inputs.viewportHeight}`);
    console.log(`  Headless:     ${inputs.headless}`);
    if (inputs.appUrl) console.log(`  App URL:      ${inputs.appUrl}`);
  }
  if (inputs.device) {
    console.log(`  Device:       ${inputs.device}`);
  }
  console.log("");

  let result: CaptureResult;

  switch (inputs.platform) {
    case "web":
      result = await captureWeb(inputs);
      break;
    case "android":
      result = await captureAndroid(inputs);
      break;
    case "ios":
      result = await captureIos(inputs);
      break;
    default:
      throw new Error(`Unsupported platform: ${inputs.platform}`);
  }

  // Resolve scenario name for summary.
  const variables: Record<string, string> = {};
  if (inputs.appUrl) variables["app-url"] = inputs.appUrl;
  let scenarioName = "Video Capture";
  try {
    const scenario = parseScenario(inputs.scenario, variables);
    scenarioName = scenario.name;
  } catch {
    // Non-critical — use default name.
  }

  // Write outputs and summary.
  setOutputs(result);
  writeSummary(result, inputs.outputDir, scenarioName);

  // Report.
  console.log("\n=== Capture Complete ===");
  if (result.videoPath) {
    console.log(`  Video:        ${result.videoPath}`);
    console.log(`  Duration:     ${result.durationSeconds}s`);
  }
  if (result.thumbnailPath) {
    console.log(`  Thumbnail:    ${result.thumbnailPath}`);
  }
  if (result.screenshotPaths.length > 0) {
    console.log(`  Screenshots:  ${result.screenshotPaths.length} captured`);
    for (const sp of result.screenshotPaths) {
      console.log(`    - ${sp}`);
    }
  }
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
