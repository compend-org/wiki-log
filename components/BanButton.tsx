// ABOUTME: An admin's button for banning someone, which asks for a reason and confirmation first.
// ABOUTME: A ban hides their profile and everything they posted, and blocks their email and sign-in.
"use client";

import { banUser } from "@/app/actions";
import ModerationButton from "@/components/ModerationButton";

export default function BanButton({
  userId,
  username,
  redirectTo,
  className = "text-sm text-danger hover:underline",
}: {
  userId: string;
  username: string;
  // Where to go once the ban has removed the page you're on. Without it the
  // page just refreshes.
  redirectTo?: string;
  className?: string;
}) {
  return (
    <ModerationButton
      label="Ban"
      title={`Ban ${username}?`}
      description="This hides their profile and everything they posted, removes their likes, shares and follows, closes the reports about them, and stops them signing in or signing up again with their email. Admins can lift the ban from their reports page."
      askReason
      danger
      redirectTo={redirectTo}
      className={className}
      run={(input) => banUser(userId, input)}
    />
  );
}
