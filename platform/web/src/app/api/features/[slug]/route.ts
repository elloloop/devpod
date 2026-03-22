import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { mockFeatures } from "@/lib/mock-data";

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

function getBodyContent(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!match) return "";
  const body = match[1].trim();
  const summaryMatch = body.match(/## Summary\n([\s\S]*?)(?=\n##|$)/);
  return summaryMatch ? summaryMatch[1].trim() : body.split("\n").slice(0, 3).join(" ");
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*"?([^"]*)"?\s*$/);
    if (kv) result[kv[1]] = kv[2];
  }
  return result;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Try real feature first
  const featureDir = findFeatureDir(slug);
  if (featureDir) {
    const featureMd = path.join(featureDir, "feature.md");
    if (fs.existsSync(featureMd)) {
      const content = fs.readFileSync(featureMd, "utf-8");
      const fm = parseFrontmatter(content);
      const description = getBodyContent(content);

      let video: string | undefined;
      for (const ext of ["demo.webm", "demo.mp4"]) {
        if (fs.existsSync(path.join(featureDir, ext))) {
          video = `/api/features/${slug}/video`;
          break;
        }
      }

      const screenshots: string[] = [];
      const ssDir = path.join(featureDir, "screenshots");
      if (fs.existsSync(ssDir)) {
        for (const ss of fs.readdirSync(ssDir).sort()) {
          if (ss.endsWith(".png") || ss.endsWith(".jpg")) {
            screenshots.push(`/api/features/${slug}/screenshots/${ss}`);
          }
        }
      }

      return NextResponse.json({
        slug,
        title: fm.title || slug,
        description,
        date: fm.date || "",
        status: fm.status || "shipped",
        prs: [],
        video,
        screenshots,
      });
    }
  }

  // Fall back to mock
  const feature = mockFeatures.find((f) => f.slug === slug);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }
  return NextResponse.json(feature);
}
