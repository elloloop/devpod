import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ActionInputs, CaptureResult } from "../types.js";
import { parseScenario } from "../scenario/parser.js";
import { compressVideo, getVideoDuration } from "../processing/video.js";
import { generateThumbnail } from "../processing/thumbnail.js";

const execFileAsync = promisify(execFile);

/** Find a booted iOS simulator UDID, or null. */
async function detectSimulator(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("xcrun", [
      "simctl",
      "list",
      "devices",
      "booted",
      "-j",
    ]);
    const json = JSON.parse(stdout) as {
      devices: Record<string, Array<{ udid: string; state: string }>>;
    };
    for (const runtime of Object.values(json.devices)) {
      for (const device of runtime) {
        if (device.state === "Booted") {
          return device.udid;
        }
      }
    }
  } catch {
    // xcrun / simctl not available.
  }
  return null;
}

/** Check if Maestro CLI is available. */
async function hasMaestro(): Promise<boolean> {
  try {
    await execFileAsync("maestro", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Capture video from a booted iOS simulator.
 *
 * Flow:
 *  1. Detect a booted simulator via xcrun simctl.
 *  2. Start `xcrun simctl io booted recordVideo`.
 *  3. Run scenario via Maestro (if available) or wait.
 *  4. Stop recording and collect video file.
 *  5. Take screenshots.
 *  6. Post-process.
 */
export async function captureIos(
  inputs: ActionInputs,
): Promise<CaptureResult> {
  const { scenario: scenarioPath, outputDir, videoQuality } = inputs;

  fs.mkdirSync(outputDir, { recursive: true });

  const udid = await detectSimulator();
  if (!udid) {
    console.warn(
      "WARNING: No booted iOS simulator detected. " +
        "Skipping iOS capture. Boot a simulator and try again.",
    );
    return {
      videoPath: null,
      screenshotPaths: [],
      thumbnailPath: null,
      durationSeconds: 0,
    };
  }

  console.log(`iOS simulator detected: ${udid}`);

  const variables: Record<string, string> = {};
  if (inputs.appUrl) variables["app-url"] = inputs.appUrl;
  const scenario = parseScenario(scenarioPath, variables);

  const rawVideoPath = path.join(outputDir, "demo-raw.mov");
  const screenshotPaths: string[] = [];

  // Start video recording via simctl.  The process runs until we send
  // SIGINT, at which point it finalises the file.
  const recordProc = spawn(
    "xcrun",
    ["simctl", "io", udid, "recordVideo", "--codec=h264", rawVideoPath],
    { stdio: "ignore" },
  );

  // Give the recorder a moment to start.
  await new Promise((r) => setTimeout(r, 1500));

  try {
    const maestroAvailable = await hasMaestro();
    if (maestroAvailable) {
      console.log("Running scenario via Maestro...");
      try {
        await execFileAsync("maestro", ["test", scenarioPath], {
          timeout: 120_000,
        });
      } catch (err) {
        console.warn(`Maestro run finished with error: ${err}`);
      }
    } else {
      console.log(
        "Maestro not available — recording for scenario step count * 2s",
      );
      const durationMs = scenario.steps.length * 2000;
      await new Promise((r) => setTimeout(r, durationMs));
    }

    // Take a screenshot.
    const screenshotLocalPath = path.join(outputDir, "final-screen.png");
    try {
      await execFileAsync("xcrun", [
        "simctl",
        "io",
        udid,
        "screenshot",
        screenshotLocalPath,
      ]);
      screenshotPaths.push(screenshotLocalPath);
    } catch (err) {
      console.warn(`Failed to capture screenshot: ${err}`);
    }
  } finally {
    // Stop recording by sending SIGINT.
    recordProc.kill("SIGINT");
    await new Promise<void>((resolve) => {
      recordProc.on("exit", () => resolve());
      setTimeout(() => {
        recordProc.kill("SIGKILL");
        resolve();
      }, 5000);
    });
  }

  if (!fs.existsSync(rawVideoPath)) {
    console.warn("Video file was not created.");
    return {
      videoPath: null,
      screenshotPaths,
      thumbnailPath: null,
      durationSeconds: 0,
    };
  }

  // Post-process.
  let finalVideoPath = rawVideoPath;
  const compressedPath = path.join(outputDir, "demo.mp4");
  const compressed = await compressVideo(rawVideoPath, compressedPath, videoQuality);
  if (compressed) {
    finalVideoPath = compressedPath;
    fs.unlinkSync(rawVideoPath);
  }

  const durationSeconds = await getVideoDuration(finalVideoPath);
  const thumbPath = path.join(outputDir, "thumbnail.png");
  const thumbnailPath = await generateThumbnail(finalVideoPath, thumbPath);

  return {
    videoPath: finalVideoPath,
    screenshotPaths,
    thumbnailPath,
    durationSeconds,
  };
}
