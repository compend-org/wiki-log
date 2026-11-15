// ABOUTME: An admin's button for suspending someone, which asks for a reason, a length and confirmation first.
// ABOUTME: A suspension stops them posting or interacting for a while and closes the open reports about them.
"use client";

import { suspendUser } from "@/app/admin/reports/actions";
import ModerationButton from "@/components/buttons/ModerationButton";

export default function SuspendButton({
  userId,
  username,
  className,
}: {
  userId: string;
  username: string;
  className?: string;
}) {
  return (
    <ModerationButton
      label="Suspend"
      title={`Suspend ${username}?`}
      description="Until it ends they can't post, comment, like, share, follow or change their profile. Their posts stay up. The open reports about them are closed as actioned. They're told why and for how long."
      askReason
      askDays
      danger
      className={className}
      run={(input) => suspendUser(userId, input)}
    />
  );
}
