import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchTitles } from "@/lib/wikipedia";
import { DEFAULT_LANG, isLang } from "@/lib/languages";
import { escapeLike } from "@/lib/username";
import { FEATURES } from "@/lib/features";

type Hit = {
  key: string;
  itemId?: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
};

// Compounds are stored in our own database, in every language
async function findCompounds(q: string): Promise<Hit[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
    const { data } = await supabase
      .from("items")
      .select("id, title, description, image_url")
      .like("id", "C%")
      .ilike("title", `%${escapeLike(q)}%`)
      .limit(3);

    return (data ?? []).map((r) => ({
      key: `compound:${r.id}`,
      itemId: r.id,
      title: r.title,
      description: `Compound${r.description ? ` · ${r.description}` : ""}`,
      imageUrl: r.image_url,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const langParam = request.nextUrl.searchParams.get("lang") ?? DEFAULT_LANG;
  const lang = isLang(langParam) ? langParam : DEFAULT_LANG;

  if (q.trim().length < 2 || q.length > 100) {
    return NextResponse.json({ results: [] });
  }

  const [compounds, wiki] = await Promise.all([
    FEATURES.compounds ? findCompounds(q.trim()) : Promise.resolve([]),
    searchTitles(q, lang),
  ]);

  return NextResponse.json(
    { results: [...compounds, ...wiki] },
    {
      headers: {
        // Short, so a newly crafted compound shows up quickly
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    }
  );
}