"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVideoInfo } from "@/lib/video";
import { cleanName, escapeLike, isValidName } from "@/lib/username";

// Looks the video up on the server and caches it (users can't write to `videos`)
async function ensureVideo(videoId: string): Promise<string | null> {
  const video = await getVideoInfo(videoId);
  if (!video) return "Couldn't find that video.";

  const { error } = await createAdminClient().from("videos").upsert({
    id: videoId,
    title: video.title,
    channel_name: video.author,
    fetched_at: new Date().toISOString(),
  });
  return error ? error.message : null;
}

export async function logVideo(input: {
  videoId: string;
  rating: number;
  review: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in to log videos." };

  if (!/^[A-Za-z0-9_-]{11}$/.test(input.videoId)) {
    return { error: "Invalid video ID." };
  }
  if (
    !Number.isFinite(input.rating) ||
    input.rating < 0.5 ||
    input.rating > 5 ||
    (input.rating * 2) % 1 !== 0
  ) {
    return { error: "Invalid rating." };
  }

  // The server looks the video up itself instead of trusting the browser
  const videoError = await ensureVideo(input.videoId);
  if (videoError) return { error: videoError };

  // Saved as the signed-in user, so RLS applies
  const { error } = await supabase.from("logs").upsert({
    user_id: userId,
    video_id: input.videoId,
    rating: input.rating,
    review: input.review.slice(0, 5000),
    logged_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  return {};
}

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to be signed in." };

  // Deleting the auth user also deletes their profile, logs, favourites and
  // follows (the foreign keys use "on delete cascade")
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  return {};
}

export async function signIn(input: {
  identifier: string;
  password: string;
}): Promise<{ error?: string }> {
  const generic = "Invalid login credentials";
  let email = input.identifier.trim();

  // No "@" means it's a name: look up the email on the server only
  if (!email.includes("@")) {
    const name = cleanName(email);
    if (!isValidName(name)) return { error: generic };

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", escapeLike(name))
      .maybeSingle();
    if (!profile) return { error: generic };

    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error || !data.user?.email) return { error: generic };
    email = data.user.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) return { error: error.message };
  return {};
}

export async function setFavourite(input: {
  position: number;
  videoId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in." };

  if (
    !Number.isInteger(input.position) ||
    input.position < 1 ||
    input.position > 5
  ) {
    return { error: "Invalid slot." };
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(input.videoId)) {
    return { error: "Invalid video ID." };
  }

  const videoError = await ensureVideo(input.videoId);
  if (videoError) return { error: videoError };

  const { error } = await supabase
    .from("favourites")
    .upsert(
      { user_id: userId, position: input.position, video_id: input.videoId },
      { onConflict: "user_id,position" }
    );
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That video is already in your top 5."
          : error.message,
    };
  }
  return {};
}

export async function removeFavourite(
  position: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in." };

  const { error } = await supabase
    .from("favourites")
    .delete()
    .eq("user_id", userId)
    .eq("position", position);
  return error ? { error: error.message } : {};
}