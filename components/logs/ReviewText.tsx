import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { REVIEW_LINK } from "@/lib/format";

// The colour of item links and mentions, in reviews, comments and drafts
export const LINK_COLOR = "text-[#1a5fd0] [[data-theme=dark]_&]:text-[#6ea8ff]";

// The longest a web address shown as its own link gets before it's cut short
const SHOWN_ADDRESS_LENGTH = 50;

// Item links and mentions as markdown links to their pages, with the label's
// markdown characters escaped so it shows as written
function withSiteLinks(text: string): string {
  return text.replace(REVIEW_LINK, (_, id: string, title: string) => {
    const isMention = id.startsWith("@");
    const label = (isMention ? `@${title}` : title).replace(
      /[\\`*_{}[\]()#+\-.!|~<>]/g,
      "\\$&",
    );
    const href = isMention ? `/people/${id.slice(1)}` : `/item/${id}`;
    return `[${label}](${href})`;
  });
}

// Links go only to web pages and to this site's own pages
function safeUrl(url: string): string {
  return /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : "";
}

// A web address written out as a link reads without https:// or www., cut
// short when it's long
function shownAddress(text: string): string {
  const shown = text.replace(/^(https?:\/\/)?(www\.)?/i, "");
  return shown.length > SHOWN_ADDRESS_LENGTH
    ? `${shown.slice(0, SHOWN_ADDRESS_LENGTH - 1)}…`
    : shown;
}

// Leading spaces stay as typed instead of starting a code block
function noIndentedCode(this: { data(): object }) {
  const data = this.data() as { micromarkExtensions?: object[] };
  data.micromarkExtensions ??= [];
  data.micromarkExtensions.push({ disable: { null: ["codeIndented"] } });
}

const PLUGINS = [remarkGfm, remarkBreaks, noIndentedCode];

// Headings read as bold text at the text's own size
const heading: Components["h1"] = ({ children }) => (
  <p className="font-bold">{children}</p>
);

const BLOCKS: Components = {
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
};

// Links that open: this site's pages in place, web pages in a new tab, and
// pictures as links to them
const LINKS: Components = {
  ...BLOCKS,
  a: ({ href, children }) => {
    if (!href) return children;
    const className = `relative z-10 hover:underline ${LINK_COLOR}`;
    if (href.startsWith("/")) {
      return (
        <Link
          href={href}
          // A mention's address only redirects, so there's nothing to prefetch
          prefetch={href.startsWith("/people/") ? false : undefined}
          className={className}
        >
          {children}
        </Link>
      );
    }
    const isAddress =
      typeof children === "string" &&
      children.replace(/^https?:\/\//i, "") ===
        href.replace(/^https?:\/\//i, "");
    return (
      <a
        href={href}
        target="_blank"
        rel="nofollow ugc noopener noreferrer"
        className={className}
      >
        {isAddress ? shownAddress(children) : children}
      </a>
    );
  },
  img: ({ src, alt }) =>
    typeof src === "string" && src ? (
      <a
        href={src}
        target="_blank"
        rel="nofollow ugc noopener noreferrer"
        className={`relative z-10 hover:underline ${LINK_COLOR}`}
      >
        {alt || shownAddress(src)}
      </a>
    ) : null,
};

// Links coloured but not clickable
const PLAIN_LINKS: Components = {
  ...BLOCKS,
  a: ({ children }) => <span className={LINK_COLOR}>{children}</span>,
  img: ({ alt }) => <span className={LINK_COLOR}>{alt}</span>,
};

// Shows a review, written in markdown, with item links and mentions as real
// links. Put it inside a div. With `plain`, the links are only coloured (for
// places where a link can't be clicked, like tooltips). Otherwise the text
// sits above a card's full-card link, so it can be selected while the space
// around it still opens the card.
export default function ReviewText({
  text,
  plain = false,
}: {
  text: string;
  plain?: boolean;
}) {
  return (
    <div
      className={
        plain ? "markdown" : "card-text markdown relative z-10 w-fit max-w-full"
      }
    >
      <Markdown
        remarkPlugins={PLUGINS}
        urlTransform={safeUrl}
        components={plain ? PLAIN_LINKS : LINKS}
      >
        {withSiteLinks(text)}
      </Markdown>
    </div>
  );
}
