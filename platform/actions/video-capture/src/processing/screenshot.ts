import * as fs from "node:fs";

/**
 * Try to load the optional `sharp` module.  Returns null when not installed.
 */
async function tryLoadSharp(): Promise<((input: string) => any) | null> {
  try {
    // Use a variable so TypeScript does not attempt static resolution.
    const moduleName = "sharp";
    const mod = await (Function(`return import("${moduleName}")`)() as Promise<any>);
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/**
 * Attempt to optimise a PNG screenshot using sharp (optional dependency).
 *
 * If sharp is not available, the original file path is returned unchanged.
 * When sharp *is* available the image is re-encoded as an optimised PNG in
 * place (over-writing the original).
 */
export async function optimizeScreenshot(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }

  try {
    const sharp = await tryLoadSharp();
    if (!sharp) {
      return filePath;
    }

    const buffer: Buffer = await sharp(filePath)
      .png({ quality: 85, compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(filePath, buffer);
    console.log(`Optimised screenshot: ${filePath}`);
  } catch {
    // Non-critical — return original.
  }

  return filePath;
}
