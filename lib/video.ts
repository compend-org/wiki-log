export const USE_STUB = process.env.NEXT_PUBLIC_USE_STUB_DATA === "true"; // set to false once the blocker is off

export type VideoInfo = {
  title: string;
  author: string;
};

export async function getVideoInfo(id: string): Promise<VideoInfo | null> {
  if (USE_STUB) {
    return { title: `Test video (${id})`, author: "Test Channel" };
  }

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
    );
    if (!res.ok) {
      console.log("oEmbed failed:", res.status, id);
      return null;
    }
    const data: { title: string; author_name: string } = await res.json();
    return { title: data.title, author: data.author_name };
  } catch (err) {
    console.log("oEmbed request error:", err);
    return null;
  }
}