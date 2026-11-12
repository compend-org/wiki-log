// ABOUTME: The signed-in person's settings: picture, bio, username, email, theme, SFW mode and blocks.
// ABOUTME: Loads everything on the server first, so the page arrives complete.
import Link from "next/link";
import { connection } from "next/server";
import AvatarUpload from "@/components/AvatarUpload";
import BioEditor from "@/components/BioEditor";
import BlockedPeople, { type BlockedPerson } from "@/components/BlockedPeople";
import DeleteAccount from "@/components/DeleteAccount";
import EmailVerification from "@/components/EmailVerification";
import SfwSetting from "@/components/SfwSetting";
import ThemeSetting from "@/components/ThemeSetting";
import UsernameEditor from "@/components/UsernameEditor";
import { loginHref } from "@/lib/redirect";
import { parseSfwMode } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type SettingsProfile = {
  username: string;
  avatar_path: string | null;
  bio: string | null;
  user_settings: { sfw_mode: string } | null;
  blocked: {
    blocked_id: string;
    profiles: { username: string } | null;
  }[];
};

export default async function SettingsPage() {
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId: string | undefined = claimsData?.claims?.sub;
  const email: string | undefined = claimsData?.claims?.email;

  // The profile with the people it blocks, newest block first, and whether
  // the email address is verified
  const [profileRes, verificationRes] = userId
    ? await Promise.all([
        supabase
          .from("profiles")
          .select(
            "username, avatar_path, bio, user_settings(sfw_mode), blocked:blocks!blocks_blocker_id_fkey(blocked_id, profiles!blocks_blocked_id_fkey(username))",
          )
          .eq("id", userId)
          .order("created_at", { referencedTable: "blocked", ascending: false })
          .maybeSingle(),
        supabase
          .from("email_verifications")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle(),
      ])
    : [
        { data: null, error: null },
        { data: null, error: null },
      ];
  const error = profileRes.error ?? verificationRes.error;
  if (error) throw new Error(`Couldn't load settings: ${error.message}`);
  const profile = profileRes.data as unknown as SettingsProfile | null;

  if (!userId || !profile) {
    return (
      <main className="p-8">
        <Link href={loginHref("/settings")} className="underline">
          Sign in to edit your profile
        </Link>
      </main>
    );
  }

  const blockedPeople: BlockedPerson[] = profile.blocked.map((r) => ({
    id: r.blocked_id,
    username: r.profiles?.username ?? "Someone",
  }));

  return (
    // A different account starts over, rather than keeping the last one's drafts
    <main
      key={userId}
      className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 p-4 sm:p-8"
    >
      <h1 className="text-3xl font-bold">Profile settings</h1>
      <p className="text-sm text-muted">
        Your username, bio, picture and logs are public. You can also sign in
        with your username.
      </p>

      <AvatarUpload
        userId={userId}
        username={profile.username}
        path={profile.avatar_path}
      />
      <BioEditor userId={userId} savedBio={profile.bio ?? ""} />

      <UsernameEditor userId={userId} savedUsername={profile.username} />
      <Link
        href={`/u/${encodeURIComponent(profile.username)}`}
        className="underline"
      >
        View your public profile
      </Link>

      {email && (
        <EmailVerification
          email={email}
          verified={Boolean(verificationRes.data)}
        />
      )}

      <ThemeSetting />

      <SfwSetting
        userId={userId}
        savedMode={parseSfwMode(profile.user_settings?.sfw_mode)}
      />

      <BlockedPeople viewerId={userId} people={blockedPeople} />

      <DeleteAccount username={profile.username} />
    </main>
  );
}
