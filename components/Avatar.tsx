import { avatarUrl } from "@/lib/avatar";

export default function Avatar({
    path,
    size = 40,
    className = "",
}: {
    // Still accepted by callers, though the default picture no longer uses it
    name?: string;
    path: string | null | undefined;
    size?: number;
    className?: string;
}) {
    const url = avatarUrl(path);
    const style = { width: size, height: size };
    const base = `avatar shrink-0 rounded-full object-cover ${className}`;

    if (!url) {
        return (
            <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/default-avi-light.png"
                    alt=""
                    width={size}
                    height={size}
                    draggable={false}
                    style={style}
                    className={`${base} [[data-theme=dark]_&]:hidden`}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/default-avi-dark.png"
                    alt=""
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url}
            alt=""
            width={size}
            height={size}
            draggable={false}
            style={style}
            className={base}
        />
    );
}