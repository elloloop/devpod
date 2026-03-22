import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { mockFeatures } from "@/lib/mock-data";

interface FeatureDoc {
  slug: string;
  title: string;
  description: string;
  date: string;
  status: string;
  prs: { number: number; title: string; repo: string; status: string }[];
  video?: string;
  screenshots: string[];
}

function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || path.resolve(process.cwd(), "../..");
}

function parseFeatureFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  // Simple YAML parser for frontmatter
  let currentKey = "";
  let currentArray: unknown[] | null = null;

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Array item
    if (trimmed.startsWith("- ") && currentArray !== null) {
      const val = trimmed.slice(2).trim();
      if (val.startsWith('"') || val.startsWith("'")) {
        currentArray.push(val.slice(1, -1));
      } else if (val.includes(":")) {
        // Object in array
        const obj: Record<string, string> = {};
        // Parse inline object or start of block object
        const kv = val.match(/^(\w+):\s*(.+)$/);
        if (kv) {
          obj[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
        }
        currentArray.push(obj);
      } else {
        currentArray.push(val.replace(/^["']|["']$/g, ""));
      }
      continue;
    }

    // Key-value
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim();

      if (val === "" || val === "|") {
        // Possibly an array or block
        currentKey = key;
        currentArray = [];
        result[key] = currentArray;
      } else {
        currentKey = key;
        currentArray = null;
        result[key] = val.replace(/^["']|["']$/g, "");
      }
    }
  }

  return result;
}

function getBodyContent(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!match) return "";

  // Get the Summary section
  const body = match[1].trim();
  const summaryMatch = body.match(/## Summary\n([\s\S]*?)(?=\n##|$)/);
  return summaryMatch ? summaryMatch[1].trim() : body.split("\n").slice(0, 3).join(" ");
}

function loadRealFeatures(): FeatureDoc[] {
  const workspaceDir = getWorkspaceDir();
  const featuresDir = path.join(workspaceDir, "docs", "features");

  if (!fs.existsSync(featuresDir)) return [];

  const features: FeatureDoc[] = [];

  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const featureMd = path.join(featuresDir, entry.name, "feature.md");
    if (!fs.existsSync(featureMd)) continue;

    const content = fs.readFileSync(featureMd, "utf-8");
    const fm = parseFeatureFrontmatter(content);
    const description = getBodyContent(content);

    const slug = (fm.slug as string) || entry.name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const dirName = entry.name;

    // Check for video and screenshots
    const featureDir = path.join(featuresDir, dirName);
    let video: string | undefined;
    const screenshots: string[] = [];

    for (const ext of ["demo.webm", "demo.mp4"]) {
      if (fs.existsSync(path.join(featureDir, ext))) {
        video = `/api/features/${slug}/video`;
        break;
      }
    }

    const screenshotDir = path.join(featureDir, "screenshots");
    if (fs.existsSync(screenshotDir)) {
      for (const ss of fs.readdirSync(screenshotDir)) {
        if (ss.endsWith(".png") || ss.endsWith(".jpg")) {
          screenshots.push(`/api/features/${slug}/screenshots/${ss}`);
        }
      }
      screenshots.sort();
    }

    features.push({
      slug,
      title: (fm.title as string) || slug,
      description,
      date: (fm.date as string) || entry.name.slice(0, 10),
      status: (fm.status as string) || "shipped",
      prs: Array.isArray(fm.prs) ? (fm.prs as FeatureDoc["prs"]) : [],
      video,
      screenshots,
    });
  }

  return features.sort((a, b) => b.date.localeCompare(a.date));
}

export async function GET() {
  const realFeatures = loadRealFeatures();

  if (realFeatures.length > 0) {
    // Merge real features with mock data (real features first)
    const realSlugs = new Set(realFeatures.map((f) => f.slug));
    const mockOnly = mockFeatures.filter((f) => !realSlugs.has(f.slug));
    return NextResponse.json([...realFeatures, ...mockOnly]);
  }

  return NextResponse.json(mockFeatures);
}
