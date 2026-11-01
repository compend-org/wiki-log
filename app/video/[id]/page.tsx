import { notFound } from "next/navigation";
import LogForm from "@/components/LogForm";
import { getVideoInfo, USE_STUB } from "@/lib/video";
import VideoLogs from "@/components/VideoLogs";
import { parseLimit } from "@/lib/paging";

export const instant = false;

export default async function VideoPage({

  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {

  const { id } = await params;
  const { limit } = await searchParams;

  const video = await getVideoInfo(id);
  if (!video) notFound();

  return (
    <main className="min-h-screen flex flex-col items-center gap-4 p-8">
      {USE_STUB ? (
        <div className="aspect-video w-full max-w-xl rounded-lg bg-surface" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt={video.title}
          className="w-full max-w-xl rounded-lg"
        />
      )}
      <h1 className="text-2xl font-bold text-center">{video.title}</h1>
      <p className="text-muted">{video.author}</p>
      <LogForm id={id} />
      <VideoLogs videoId={id} limit={parseLimit(limit)} />
    </main>
  );
}