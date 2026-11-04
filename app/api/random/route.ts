import { NextRequest, NextResponse } from "next/server";
import { getRandomItem } from "@/lib/wikipedia";
import { DEFAULT_LANG, isLang } from "@/lib/languages";

export async function GET(request: NextRequest) {
  const langParam = request.nextUrl.searchParams.get("lang") ?? DEFAULT_LANG;
  const lang = isLang(langParam) ? langParam : DEFAULT_LANG;

  const result = await getRandomItem(lang);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json(
    { id: result.item.id, title: result.item.title },
    // A random page must be different every time
    { headers: { "Cache-Control": "no-store" } }
  );
}