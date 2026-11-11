// ABOUTME: Sends a link to a person, by their id, to their profile under their current username.
// ABOUTME: Mentions link here, so they keep working after the person renames themselves.
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/people/[id]">,
) {
  await connection();
  const { id } = await params;
  const { data } = await createPublicClient()
    .from("profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  redirect(`/u/${encodeURIComponent(data.username)}`);
}
