// ABOUTME: A round profile picture, or the default picture for people without one.
// ABOUTME: Tiny displays load the small stored copy to save bandwidth.
import { avatarUrl } from "@/lib/avatar";
import defaultAvatarDark from "@/public/default-avi-dark.png";
import defaultAvatarLight from "@/public/default-avi-light.png";

export default function Avatar({
  path,
  size = 40,
  className = "",
  loading = "lazy",
}: {
  // Still accepted by callers, though the default picture no longer uses it
  name?: string;
  path: string | null | undefined;
  size?: number;
  className?: string;
  // "eager" for pictures shown from the first paint, which lazy loading
  // would leave blank until the browser gets round to them
  loading?: "lazy" | "eager";
}) {
  const url = avatarUrl(path, size);
  const style = { width: size, height: size };
  const base = `avatar shrink-0 rounded-full object-cover ${className}`;

  if (!url) {
    return (
      <>
        {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
        <img
          src={defaultAvatarLight.src}
          alt=""
          loading={loading}
          width={size}
          height={size}
          draggable={false}
          style={style}
          className={`${base} [[data-theme=dark]_&]:hidden`}
        />
        {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
        <img
          src={defaultAvatarDark.src}
          alt=""
          loading={loading}
          width={size}
          height={size}
          draggable={false}
          style={style}
          className={`${base} hidden [[data-theme=dark]_&]:block`}
        />
      </>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: a plain img is intended
    <img
      src={url}
      alt=""
      loading={loading}
      width={size}
      height={size}
      draggable={false}
      style={style}
      className={base}
    />
  );
}
