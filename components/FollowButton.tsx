"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FollowButton({
    viewerId,
    targetId,
    initiallyFollowing,
}: {
    viewerId: string;
    targetId: string;
    initiallyFollowing: boolean;
}) {
    const [following, setFollowing] = useState<boolean>(initiallyFollowing);
    const [busy, setBusy] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const router = useRouter();

    async function toggle() {
        setBusy(true);
        setError("");
        const supabase = createClient();
        const { error } = following
            ? await supabase
                .from("follows")
                .delete()
                .eq("follower_id", viewerId)
                .eq("following_id", targetId)
            : await supabase
                .from("follows")
                .insert({ follower_id: viewerId, following_id: targetId });
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        setFollowing(!following);
        router.refresh(); // updates the follower counts
    }

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className={
                    following
                        ? "rounded-lg border border-line px-4 py-2 disabled:opacity-40"
                        : "rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
                }
            >
                {following ? "Following ✓" : "Follow"}
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
        </div>
    );
}