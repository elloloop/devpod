import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || path.resolve(process.cwd(), "../..");
}

function findFeatureDir(slug: string): string | null {
  const featuresDir = path.join(getWorkspaceDir(), "docs", "features");
  if (!fs.existsSync(featuresDir)) return null;

  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dirSlug = entry.name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    if (dirSlug === slug) {
      return path.join(featuresDir, entry.name);
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  const { slug, filename } = await params;
  const featureDir = findFeatureDir(slug);

  if (!featureDir) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  const screenshotPath = path.join(featureDir, "screenshots", filename);

  if (!fs.existsSync(screenshotPath)) {
    return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(screenshotPath);
  const contentType = filename.endsWith(".png") ? "image/png" : "image/jpeg";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
