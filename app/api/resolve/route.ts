import { NextRequest, NextResponse } from "next/server";
import { getItemByKey } from "@/lib/wikipedia";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!key || key.length > 200) {
    return NextResponse.json({ error: "Invalid article." }, { status: 400 });
  }

  const result = await getItemByKey(key);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ id: result.item.id });
}