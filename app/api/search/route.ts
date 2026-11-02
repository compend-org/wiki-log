import { NextRequest, NextResponse } from "next/server";
import { searchTitles } from "@/lib/wikipedia";
import { DEFAULT_LANG, isLang } from "@/lib/languages";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const langParam = request.nextUrl.searchParams.get("lang") ?? DEFAULT_LANG;
  const lang = isLang(langParam) ? langParam : DEFAULT_LANG;

  if (q.trim().length < 2 || q.length > 100) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchTitles(q, lang);
  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}