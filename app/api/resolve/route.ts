import { NextRequest, NextResponse } from "next/server";
import { getItemByKey } from "@/lib/wikipedia";
import { DEFAULT_LANG, isLang } from "@/lib/languages";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const langParam = request.nextUrl.searchParams.get("lang") ?? DEFAULT_LANG;
  const lang = isLang(langParam) ? langParam : DEFAULT_LANG;

  if (!key || key.length > 200) {
    return NextResponse.json({ error: "Invalid article." }, { status: 400 });
  }

  const result = await getItemByKey(key, lang);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ id: result.item.id });
}