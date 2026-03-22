import { NextResponse } from "next/server";
import { mockFeatures } from "@/lib/mock-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const feature = mockFeatures.find((f) => f.slug === slug);

  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  return NextResponse.json(feature);
}
