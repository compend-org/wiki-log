import { NextRequest, NextResponse } from "next/server";
import { searchTitles } from "@/lib/wikipedia";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2 || q.length > 100) {
    return NextResponse.json({ results: [] });
  }
  const results = await searchTitles(q);
  return NextResponse.json({ results });
}