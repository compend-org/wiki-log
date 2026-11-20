// ABOUTME: A very small compend logo placed before a link, marking it as a page on this site.
// ABOUTME: Both logos are drawn; the theme (see globals.css) shows the one that suits it.
import logoDark from "@/public/logo-dark.png";
import logoLight from "@/public/logo-light.png";

// inline-block: the CSS reset makes images block-level, which put the link on a new line
const SIZE =
  "inline-block h-[0.85em] w-auto border-0 align-[-0.1em]";

export default function SiteMark() {
  return (
    <>
      {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
      <img
        src={logoLight.src}
        alt=""
        aria-hidden="true"
        className={`logo-light ${SIZE} mr-[0.1em]`}
      />
      {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
      <img
        src={logoDark.src}
        alt=""
        aria-hidden="true"
        className={`logo-dark ${SIZE} mr-[0.0725em]`}
      />
    </>
  );
}
