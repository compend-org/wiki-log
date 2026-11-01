"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { readLogs, deleteLog, type Log } from "@/lib/logs";
import ItemImage from "@/components/ItemImage";
import Stars from "@/components/Stars";

export default function DiaryPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [signedIn, setSignedIn] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      const { data } = await createClient().auth.getUser();
      if (data.user) {
        setSignedIn(true);
        setLogs(await readLogs(data.user.id));
      } else {
        setSignedIn(false);
        setLogs([]);
      }
      setLoaded(true);
    }

    load();

    function handleVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", load);
    };
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this log?")) return;
    const error = await deleteLog(id);
    if (error) {
      window.alert(error);
      return;
    }
    setLogs((prev) => prev.filter((log) => log.id !== id));
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Diary</h1>

      {loaded && !signedIn && (
        <Link href="/login" className="underline">
          Sign in to see your diary
        </Link>
      )}

      {loaded && signedIn && logs.length === 0 && (
        <p className="text-muted">Nothing logged yet.</p>
      )}

      {logs.map((log) => (
        <div key={log.id} className="card flex items-start gap-2 p-3">
          <Link href={`/item/${log.id}`} className="flex flex-1 gap-4">
            <ItemImage
              src={log.imageUrl}
              alt={log.title}
              className="h-20 w-20 shrink-0 rounded"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold">{log.title}</span>
              <Stars rating={log.rating} />
              {log.review && <p className="text-sm">{log.review}</p>}
              <span className="text-xs text-muted">
                {new Date(log.loggedAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(log.id)}
            className="text-sm text-danger"
          >
            Delete
          </button>
        </div>
      ))}
    </main>
  );
}