import Link from "next/link";

export default function Footer() {
    return (
        <footer className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface px-4 py-2 text-center text-xs text-muted sm:px-8">
            <nav
                aria-label="Footer"
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
            >
                <Link href="/privacy" className="hover:text-foreground hover:underline">
                    Privacy
                </Link>
                <Link href="/guide" className="hover:text-foreground hover:underline">
                    &quot;Style Guide&quot;
                </Link>
                <Link href="/contact" className="hover:text-foreground hover:underline">
                    Contact
                </Link>
            </nav>
        </footer>
    );
}