import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ActionInputs, CaptureResult } from "../types.js";
import { parseScenario } from "../scenario/parser.js";
import { compressVideo, getVideoDuration } from "../processing/video.js";
import { generateThumbnail } from "../processing/thumbnail.js";

const execFileAsync = promisify(execFile);

/** Check if adb is available and at least one device is connected. */
async function detectDevice(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("adb", ["devices"]);
    const lines = stdout
      .split("\n")
      .slice(1)
      .filter((l) => l.trim().endsWith("device"));
    if (lines.length > 0) {
      const serial = lines[0].split("\t")[0].trim();
      return serial;
    }
  } catch {
    // adb not available
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
 * Capture video from an Android device or emulator.
 *
 * Flow:
 *  1. Detect a connected device via adb.
 *  2. Start `adb shell screenrecord`.
 *  3. Run scenario via Maestro (if available) or just record for a fixed
 *     duration.
 *  4. Pull the recording from the device.
 *  5. Take screenshots at the end.
 *  6. Post-process.
 */
export async function captureAndroid(
  inputs: ActionInputs,
): Promise<CaptureResult> {
  const { scenario: scenarioPath, outputDir, videoQuality } = inputs;

  fs.mkdirSync(outputDir, { recursive: true });

  // Verify device.
  const serial = await detectDevice();
  if (!serial) {
    console.warn(
      "WARNING: No Android device/emulator detected. " +
        "Skipping Android capture. Connect a device and try again.",
    );
    return {
      videoPath: null,
      screenshotPaths: [],
      thumbnailPath: null,
      durationSeconds: 0,
    };
  }

  console.log(`Android device detected: ${serial}`);

  const variables: Record<string, string> = {};
  if (inputs.appUrl) variables["app-url"] = inputs.appUrl;
  const scenario = parseScenario(scenarioPath, variables);

  const deviceVideoPath = "/sdcard/demo-recording.mp4";
  const localVideoPath = path.join(outputDir, "demo-raw.mp4");
  const screenshotPaths: string[] = [];

  // Start screen recording in background.
  const recordProc = execFile("adb", [
    "-s",
    serial,
    "shell",
    "screenrecord",
    "--bit-rate",
    videoQuality === "high" ? "8000000" : videoQuality === "low" ? "2000000" : "4000000",
    deviceVideoPath,
  ]);

  // Give screenrecord a moment to initialise.
  await new Promise((r) => setTimeout(r, 1000));

  try {
    // Execute scenario.
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

    // Take a screenshot at the end.
    const screenshotDevicePath = "/sdcard/demo-screenshot.png";
    const screenshotLocalPath = path.join(outputDir, "final-screen.png");
    try {
      await execFileAsync("adb", [
        "-s",
        serial,
        "shell",
        "screencap",
        "-p",
        screenshotDevicePath,
      ]);
      await execFileAsync("adb", [
        "-s",
        serial,
        "pull",
        screenshotDevicePath,
        screenshotLocalPath,
      ]);
      screenshotPaths.push(screenshotLocalPath);
      // Clean up device file.
      await execFileAsync("adb", [
        "-s",
        serial,
        "shell",
        "rm",
        screenshotDevicePath,
      ]).catch(() => {});
    } catch (err) {
      console.warn(`Failed to capture screenshot: ${err}`);
    }
  } finally {
    // Stop screen recording.
    try {
      await execFileAsync("adb", ["-s", serial, "shell", "killall", "-INT", "screenrecord"]);
    } catch {
      // Process may have already exited.
    }
    // Wait for process to finish writing.
    await new Promise<void>((resolve) => {
      if (recordProc.exitCode !== null) {
        resolve();
      } else {
        recordProc.on("exit", () => resolve());
        // Safety timeout.
        setTimeout(() => {
          recordProc.kill("SIGKILL");
          resolve();
        }, 5000);
      }
    });
  }

  // Pull video from device.
  try {
    await execFileAsync("adb", ["-s", serial, "pull", deviceVideoPath, localVideoPath]);
    await execFileAsync("adb", ["-s", serial, "shell", "rm", deviceVideoPath]).catch(
      () => {},
    );
  } catch (err) {
    console.warn(`Failed to pull video: ${err}`);
    return {
      videoPath: null,
      screenshotPaths,
      thumbnailPath: null,
      durationSeconds: 0,
    };
  }

  // Post-process.
  let finalVideoPath = localVideoPath;
  const compressedPath = path.join(outputDir, "demo.mp4");
  const compressed = await compressVideo(localVideoPath, compressedPath, videoQuality);
  if (compressed) {
    finalVideoPath = compressedPath;
    fs.unlinkSync(localVideoPath);
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
