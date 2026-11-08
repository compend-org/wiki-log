// ABOUTME: Asks the auth server who is signed in, falling back to the stored session when it can't answer.
// ABOUTME: A failed request says nothing about the session, so only a deleted account ends it here.
import {
  isAuthApiError,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export async function confirmCurrentUser(
  supabase: SupabaseClient,
): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (data.user) return data.user;

  // The client keeps a session for an account that no longer exists, so it has
  // to be forgotten here. It removes sessions the server has ended by itself.
  if (isAuthApiError(error) && error.code === "user_not_found") {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  const { data: stored } = await supabase.auth.getSession();
  return stored.session?.user ?? null;
}
