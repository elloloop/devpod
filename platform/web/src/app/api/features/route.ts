import { NextResponse } from "next/server";
import { mockFeatures } from "@/lib/mock-data";

export async function GET() {
  // In production, this would read from docs/features/ directory
  // For now, return mock data
  return NextResponse.json(mockFeatures);
}
