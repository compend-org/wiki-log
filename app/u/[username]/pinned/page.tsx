// ABOUTME: Everything a person has pinned, in their order, as cards that load as you scroll.
// ABOUTME: Reached by clicking the Pinned heading on their profile.
import type { Metadata } from "next";
import { connection } from "next/server";
import ProfileAll from "@/components/profile/ProfileAll";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  await connection();
  const { username } = await params;
  const profile = await getProfileByName(username);
  if (!profile) return {};
  return pageMetadata({ title: `${profile.username}'s pins` });
}

export default async function ProfilePinnedPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <ProfileAll username={username} kind="pinned" />;
}
