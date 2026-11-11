import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { FEATURES } from "@/lib/features";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/connection";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";
import { escapeLike } from "@/lib/username";

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
    const supabase = createClient(supabaseUrl(), supabasePublishableKey(), {
      global: { fetch: reportFailedResponses },
    });
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

  if (!FEATURES.compounds || q.trim().length < 2 || q.length > 100) {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json(
    { results: await findCompounds(q.trim()) },
    {
      headers: {
        // Short, so a newly crafted compound shows up quickly
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    },
  );
}
