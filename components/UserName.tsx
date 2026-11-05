// ABOUTME: A person's username linked to their profile, followed by the admin badge if they are one.
// ABOUTME: Renders as sibling elements so it can sit inside a flex row of card metadata.
import Link from "next/link";
import AdminBadge from "@/components/AdminBadge";
import Avatar from "@/components/Avatar";
import { getAdminIds } from "@/lib/admin";

// Shows the person's picture before their name when `avatarPath` is given
// (null means they have no picture and get the default one).
export default async function UserName({
  userId,
  username,
  avatarPath,
}: {
  userId: string;
  username: string | null | undefined;
  avatarPath?: string | null;
}) {
  const adminIds = await getAdminIds();

  return (
    <>
      {username ? (
        <Link
          href={`/u/${encodeURIComponent(username)}`}
          className="relative z-10 inline-flex items-center gap-1.5 hover:underline"
        >
          {avatarPath !== undefined && (
            <Avatar name={username} path={avatarPath} size={16} />
          )}
          {username}
        </Link>
      ) : (
        <span>Someone</span>
      )}
      {adminIds.has(userId) && <AdminBadge />}
    </>
  );
}
