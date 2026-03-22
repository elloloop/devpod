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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const featureDir = findFeatureDir(slug);

  if (!featureDir) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  // Try webm first, then mp4
  for (const filename of ["demo.webm", "demo.mp4"]) {
    const videoPath = path.join(featureDir, filename);
    if (fs.existsSync(videoPath)) {
      const buffer = fs.readFileSync(videoPath);
      const contentType = filename.endsWith(".webm") ? "video/webm" : "video/mp4";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  return NextResponse.json({ error: "Video not found" }, { status: 404 });
}
