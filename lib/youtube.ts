// Pulls the 11-character video ID out of the common YouTube URL formats
export function getVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}