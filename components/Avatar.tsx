import { avatarUrl } from "@/lib/avatar";

export default function Avatar({
  name,
  path,
  size = 40,
  className = "",
}: {
  name: string;
  path: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const url = avatarUrl(path);
  const style = { width: size, height: size };

  if (!url) {
    return (
      <div
        aria-hidden="true"
        style={style}
        className={`avatar flex shrink-0 items-center justify-center rounded-full bg-surface text-muted ${className}`}
      >
        <span
          style={{ fontSize: size * 0.45 }}
          className="font-[family-name:var(--font-display-src)] uppercase leading-none"
        >
          {name.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={style}
      className={`avatar shrink-0 rounded-full object-cover ${className}`}
    />
  );
}