import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);

/**
 * Try to load the optional `sharp` module.  Returns null when not installed.
 */
async function tryLoadSharp(): Promise<((input: string) => any) | null> {
  try {
    const moduleName = "sharp";
    const mod = await (Function(`return import("${moduleName}")`)() as Promise<any>);
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/**
 * Generate a thumbnail from the first "interesting" frame of a video.
 *
 * Uses ffmpeg to seek 1 second in (to skip a possible blank startup frame)
 * and extract a single PNG frame.  Falls back gracefully when ffmpeg is not
 * available — returning null.
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
): Promise<string | null> {
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      "1",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outputPath,
    ]);

    if (fs.existsSync(outputPath)) {
      console.log(`Generated thumbnail: ${outputPath}`);

      // Attempt to optimise with sharp if available.
      try {
        const sharp = await tryLoadSharp();
        if (sharp) {
          const buffer: Buffer = await sharp(outputPath)
            .resize(640, 360, { fit: "inside" })
            .png({ quality: 80 })
            .toBuffer();
          fs.writeFileSync(outputPath, buffer);
        }
      } catch {
        // Non-critical.
      }

      return outputPath;
    }
  } catch {
    console.log("ffmpeg not available — skipping thumbnail generation");
  }
  return null;
}
